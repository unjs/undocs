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
 *     way the config `redirects` 301s are meant to be). Always a page from the
 *     index, URI-ENCODED (a page path is its filename, spaces and all, and a
 *     `Location` header must be ASCII) — so callers compare it to the request
 *     path decoded, or a page the routes fail to find would redirect to itself.
 *   - `results` — candidates for a search-results 404.
 *
 * Confidence comes in four tiers, cheapest and most certain first:
 *
 *   1. the same path once spelling noise is stripped (case, `NN.` prefixes,
 *      `.html`/`.md`, `/index`, a leading `/docs`, `_` for `-`);
 *   2. a last segment that exactly one page shares (`/deploy` → `/guide/deploy`);
 *   3. a last segment close enough to be a typo of one page's, with a clear
 *      margin over the runner-up;
 *   4. the path's words matching a page or heading TITLE exactly, on one page
 *      only (`/vercel` → `/guide/deploy#vercel`). Titles, and whole words:
 *      body text with prefix/fuzzy matching puts a word on SOME page for almost
 *      any guess, so one passing mention would decide the redirect.
 *
 * Every tier refuses to redirect when two pages tie: a coin-flip redirect is
 * worse than a results page, because the agent cannot see it was a guess.
 *
 * The input is attacker-sized (any URL), so it is bounded before any work:
 * past `MAX_GUESS` there is nothing to suggest, the slug is only edit-distanced
 * up to `MAX_SLUG`, and the query is at most `MAX_WORDS` words.
 */
import MiniSearch, { type SearchOptions } from "minisearch";
import {
  MINISEARCH_FUZZY_SEARCH_OPTIONS,
  MINISEARCH_OPTIONS,
  MINISEARCH_SEARCH_OPTIONS,
  type SearchDocument,
} from "./search-options.ts";
import type { ContentIndex, DocPage } from "./types.ts";

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

/**
 * Last-segment similarity a tier-3 redirect must EXCEED, and its lead over the
 * runner-up. Exceed, because exactly 0.8 is one letter of five — `/books` is not
 * a typo of `/hooks`.
 */
const TYPO_MIN = 0.8;
const TYPO_MARGIN = 0.1;
/** Below this a slug is not close enough to be listed on similarity alone. */
const LIST_MIN = 0.6;

const MAX_GUESS = 256;
const MAX_SLUG = 64;
const MAX_WORDS = 8;

/** Tier 4: whole words, titles only — see the header. */
const TITLE_MATCH: SearchOptions = {
  fields: ["title"],
  prefix: false,
  fuzzy: false,
  combineWith: "AND",
};

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
  if (guess.length > MAX_GUESS) return { results: [] };
  const pages = index.pages.map((page) => ({ page, norm: normalizeGuess(page.path) }));
  const redirectTo = (page: DocPage, hash = ""): Suggestions => ({
    redirect: encodeURI(page.path + hash),
    results: [toSuggestion(page)],
  });

  // Tier 1: the same path, spelled differently. `/docs/x` is the commonest
  // cross-site guess; the literal path is tried first, so a real `/docs` section
  // still wins. Two pages can normalize alike (`foo_bar`, `foo-bar`) — a tie.
  const bare = guess.replace(/^\/docs(?=\/|$)/, "") || "/";
  let exact = pages.filter((c) => c.norm === guess);
  if (!exact.length && bare !== guess) exact = pages.filter((c) => c.norm === bare);
  if (exact.length === 1) return redirectTo(exact[0]!.page);

  // Tier 2: a last segment exactly one page shares.
  const last = lastSegment(guess);
  if (last && !exact.length) {
    const sameLast = pages.filter((c) => lastSegment(c.norm) === last);
    if (sameLast.length === 1) return redirectTo(sameLast[0]!.page);
  }

  // Tier 3: a typo of a slug. Scored on the last segment alone, never the whole
  // path: a shared `/api/utils/` prefix makes `/api/utils/hash` look 87% like
  // `/api/utils/path`, which is two different pages, not a typo.
  const slug = last.length <= MAX_SLUG ? last : "";
  const ranked = pages
    .map((c) => ({ ...c, score: slug ? similarity(slug, lastSegment(c.norm), LIST_MIN) : 0 }))
    .sort((a, b) => b.score - a.score);
  const [best, second] = ranked;
  if (
    !exact.length &&
    best &&
    best.score > TYPO_MIN &&
    best.score - (second?.score ?? 0) >= TYPO_MARGIN
  ) {
    return redirectTo(best.page);
  }

  // Tier 4: the path's words against titles — all of them, then the last
  // segment's alone, since a guessed parent (`/reference/…`) is rarely in the
  // title it was meant to find.
  const query = words(bare);
  const slugQuery = words(last);
  const ms = searchIndex(index);
  // Only with the slug's own words in play: a parent alone (`/guide/<junk>`)
  // says where the guess was, not what it was for.
  if (!exact.length && slugQuery) {
    let titled = ms.search(query, TITLE_MATCH);
    if (!titled.length && slugQuery && slugQuery !== query) {
      titled = ms.search(slugQuery, TITLE_MATCH);
    }
    const onePage = titled.length > 0 && new Set(titled.map((h) => pageOf(h.id))).size === 1;
    if (onePage) {
      const top = toHit(titled[0] as unknown as SearchDocument);
      const page = index.byPath.get(top.path);
      if (page) return { ...redirectTo(page, top.hash), results: [top] };
    }
  }

  // The list: the full query with the palette's own ranking, then — OR-combined,
  // so on the slug alone, or a section name in the path (`guide`) would match
  // nearly every page — the typo-tolerant pass.
  let hits = query ? ms.search(query, MINISEARCH_SEARCH_OPTIONS) : [];
  if (!hits.length && slugQuery) hits = ms.search(slugQuery, MINISEARCH_FUZZY_SEARCH_OPTIONS);
  const searched = hits.map((hit) => toHit(hit as unknown as SearchDocument));

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

function toSuggestion(page: DocPage): PageSuggestion {
  return { path: page.path, title: page.title, preview: page.description || "" };
}

function toHit(doc: SearchDocument): PageSuggestion {
  const [path, anchor] = doc.id.split("#");
  return {
    path: path!,
    ...(anchor ? { hash: `#${anchor}` } : {}),
    title: doc.title,
    ...(doc.titles?.length ? { breadcrumb: doc.titles.join(" > ") } : {}),
    preview: doc.preview || "",
  };
}

function pageOf(id: string): string {
  return id.split("#")[0]!;
}

function words(norm: string): string {
  return norm
    .split(/[/-]+/)
    .filter((w) => w && w.length <= MAX_SLUG)
    .slice(0, MAX_WORDS)
    .join(" ");
}

function lastSegment(norm: string): string {
  return norm.slice(norm.lastIndexOf("/") + 1);
}

/**
 * `1 - edit distance / longer length`: 1 for equal strings, 0 for nothing shared.
 * Below `floor` the exact value is not needed, so a length gap that already
 * rules it out answers from the lengths alone, without the O(n·m) table.
 */
export function similarity(a: string, b: string, floor = 0): number {
  if (a === b) return 1;
  const longer = Math.max(a.length, b.length);
  if (longer === 0) return 1;
  const ceiling = 1 - Math.abs(a.length - b.length) / longer;
  if (ceiling < floor) return ceiling;
  return 1 - editDistance(a, b) / longer;
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
