/**
 * What did a 404 MEAN? Agents guess URLs far more than visitors do — from a repo
 * path (`/1.guide/2.deploy`), from another site's layout (`/docs/deploy`,
 * `/guide/deploy.html`), from a half-remembered slug (`/guide/deployment`) — so
 * a missing path is usually a near miss of a real page, and a bare "not found"
 * throws that signal away.
 *
 * `suggestPages` ranks the real pages against the missing path and answers in
 * one of two ways:
 *
 *   - `redirect` — the guess is unambiguous, so the caller sends the client
 *     there (a 302: a GUESS, not a move, so nothing should canonicalize it the
 *     way the config `redirects` 301s are meant to be). Only ever a path from the
 *     index, so following it can never 404 and loop.
 *   - `results` — candidates for a search-results 404.
 *
 * Confidence comes in four tiers, cheapest and most certain first:
 *
 *   1. the same path once spelling noise is stripped (case, `NN.` prefixes,
 *      `.html`/`.md`, `/index`, a leading `/docs`, `_` for `-`);
 *   2. a last segment that exactly one page shares (`/deploy` → `/guide/deploy`);
 *   3. a last segment close enough to be a typo of one page's, with a clear
 *      margin over the runner-up;
 *   4. a strict full-text search on the path's words whose hits all land on ONE
 *      page.
 *
 * Every tier refuses to redirect when two pages tie: a coin-flip redirect is
 * worse than a results page, because the agent cannot see it was a guess.
 */
import MiniSearch from "minisearch";
import {
  MINISEARCH_FUZZY_SEARCH_OPTIONS,
  MINISEARCH_OPTIONS,
  MINISEARCH_SEARCH_OPTIONS,
  type SearchDocument,
} from "./search-options.ts";
import type { ContentIndex } from "./types.ts";

export interface PageSuggestion {
  /** Route path of the page, e.g. `/guide/deploy`. */
  path: string;
  /** Anchor of the matched heading, e.g. `#vercel`; absent for a page-level match. */
  hash?: string;
  title: string;
  /** Ancestor headings of the matched section, when it is one. */
  breadcrumb?: string;
  preview: string;
}

export interface Suggestions {
  /** Route path (plus `#hash`) to send the client to, when the guess is unambiguous. */
  redirect?: string;
  results: PageSuggestion[];
}

export const SUGGEST_LIMIT = 8;

/** Last-segment similarity a tier-3 redirect needs, and its lead over the runner-up. */
const TYPO_MIN = 0.8;
const TYPO_MARGIN = 0.1;
/** Below this a slug is not close enough to be listed on similarity alone. */
const LIST_MIN = 0.6;

/** Normalize a path's spelling so near-identical guesses compare equal. */
export function normalizeGuess(path: string): string {
  let p: string;
  try {
    p = decodeURIComponent(path);
  } catch {
    p = path;
  }
  const segs = p
    .split(/[?#]/)[0]!
    .toLowerCase()
    .replace(/\.(?:html?|mdx?|php|aspx?)$/, "")
    .split("/")
    .filter(Boolean)
    // Repo spelling: `1.guide/2.deploy`.
    .map((s) => s.replace(/^\d+\./, "").replaceAll(/[\s_]+/g, "-"));
  if (segs.at(-1) === "index" || segs.at(-1) === "readme") segs.pop();
  return "/" + segs.join("/");
}

export function suggestPages(index: ContentIndex, path: string): Suggestions {
  const guess = normalizeGuess(path);
  const pages = index.pages.map((page) => ({ page, norm: normalizeGuess(page.path) }));

  // Tier 1: the same path, spelled differently. `/docs/x` is the commonest
  // cross-site guess; the literal path is tried first, so a real `/docs` section
  // still wins.
  const bare = guess.replace(/^\/docs(?=\/|$)/, "") || "/";
  const exact =
    pages.find((c) => c.norm === guess) ??
    (bare === guess ? undefined : pages.find((c) => c.norm === bare));
  if (exact) {
    return { redirect: exact.page.path, results: [toSuggestion(exact.page)] };
  }

  // Tier 2: a last segment exactly one page shares.
  const last = lastSegment(guess);
  if (last) {
    const sameLast = pages.filter((c) => lastSegment(c.norm) === last);
    if (sameLast.length === 1) {
      return { redirect: sameLast[0]!.page.path, results: [toSuggestion(sameLast[0]!.page)] };
    }
  }

  // Tier 3: a typo of a slug. Scored on the last segment alone, never the whole
  // path: a shared `/api/utils/` prefix makes `/api/utils/hash` look 87% like
  // `/api/utils/path`, which is two different pages, not a typo.
  const ranked = pages
    .map((c) => ({ ...c, score: last ? similarity(last, lastSegment(c.norm)) : 0 }))
    .sort((a, b) => b.score - a.score);
  const [best, second] = ranked;
  if (best && best.score >= TYPO_MIN && best.score - (second?.score ?? 0) >= TYPO_MARGIN) {
    return { redirect: best.page.path, results: [toSuggestion(best.page)] };
  }

  // Tier 4: the path's words as a query — all of them, then the last segment's
  // alone, since a guessed parent (`/reference/…`) rarely appears in the prose
  // and the AND query would fail on it. Only these STRICT passes may redirect:
  // the fuzzy fallback trades precision for recall, which suits a list and not
  // a jump.
  const query = words(bare);
  const ms = searchIndex(index);
  let hits = query ? ms.search(query, MINISEARCH_SEARCH_OPTIONS) : [];
  if (!hits.length && last && words(last) !== query) {
    hits = ms.search(words(last), MINISEARCH_SEARCH_OPTIONS);
  }
  const strict = hits.length > 0;
  // OR-combined, so it searches the slug alone: a section name in the path
  // (`guide`) would otherwise match nearly every page and outrank the one word
  // that says what was wanted.
  if (!strict && query) hits = ms.search(words(last) || query, MINISEARCH_FUZZY_SEARCH_OPTIONS);

  const searched = hits.map((hit) => {
    const doc = hit as unknown as SearchDocument;
    const [pagePath, anchor] = doc.id.split("#");
    return {
      path: pagePath!,
      ...(anchor ? { hash: `#${anchor}` } : {}),
      title: doc.title,
      ...(doc.titles?.length ? { breadcrumb: doc.titles.join(" > ") } : {}),
      preview: doc.preview || "",
    } satisfies PageSuggestion;
  });

  if (strict && new Set(searched.map((s) => s.path)).size === 1) {
    const top = searched[0]!;
    return { redirect: top.path + (top.hash ?? ""), results: [top] };
  }

  // Results: close slugs first (what the agent most likely meant), then the
  // text hits; one row per page, since a second hit on the same page adds a
  // click target that goes to the same place.
  const results: PageSuggestion[] = [];
  const seen = new Set<string>();
  const add = (s: PageSuggestion) => {
    if (seen.has(s.path) || results.length >= SUGGEST_LIMIT) return;
    seen.add(s.path);
    results.push(s);
  };
  for (const c of ranked) {
    if (c.score < LIST_MIN) break;
    add(toSuggestion(c.page));
  }
  for (const s of searched) add(s);
  return { results };
}

function toSuggestion(page: ContentIndex["pages"][number]): PageSuggestion {
  return { path: page.path, title: page.title, preview: page.description || "" };
}

function words(norm: string): string {
  return norm.replaceAll(/[/-]+/g, " ").trim();
}

function lastSegment(norm: string): string {
  return norm.slice(norm.lastIndexOf("/") + 1);
}

/** `1 - edit distance / longer length`: 1 for equal strings, 0 for nothing shared. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const longer = Math.max(a.length, b.length);
  return longer === 0 ? 1 : 1 - editDistance(a, b) / longer;
}

/**
 * Optimal-string-alignment distance: Levenshtein plus adjacent transposition at
 * cost 1. Plain Levenshtein charges a swapped pair (`deplyo`) twice, which on a
 * short slug is the difference between a typo and a different word.
 */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

// Rehydrated once per built index. A process singleton keyed by the index
// itself, so a rebuild (dev reload) drops it along with the index.
const indexes = new WeakMap<ContentIndex, MiniSearch<SearchDocument>>();

function searchIndex(index: ContentIndex): MiniSearch<SearchDocument> {
  let ms = indexes.get(index);
  if (!ms) {
    ms = MiniSearch.loadJS<SearchDocument>(index.searchIndex, MINISEARCH_OPTIONS);
    indexes.set(index, ms);
  }
  return ms;
}
