// Shared MiniSearch config — client-safe (no node/wasm deps). Server builds
// the index with these options (`search.ts`); client rehydrates via
// `MiniSearch.loadJS(data, MINISEARCH_OPTIONS)` (`DocsSearch.vue`). The two
// MUST match (same fields/storeFields/idField/tokenize) since options aren't
// serialized in `toJSON()` — both sides import this same object/function, so
// they match by construction. A divergent tokenizer would silently corrupt search.
import type { Options, SearchOptions } from "minisearch";
import type { SearchSection } from "./types";

// Max characters of body text STORED per section for rendering the result
// snippet. Full-text search is unaffected — the whole `content` is still
// tokenized into the index; this only bounds the stored display text (and thus
// the payload). Long enough to window a snippet around an early match; matches
// deeper than this still rank/find, they just show the section's opening text.
export const PREVIEW_MAX = 300;

// A section prepared for indexing. `_id` is a synthetic unique doc id, since
// the real `id` (`path#slug`) isn't unique (two headings can share an anchor)
// — it rides along as a stored field for navigation instead. `preview` is
// bounded display text; `content` is indexed but not stored, keeping payload small.
export interface SearchDocument extends SearchSection {
  _id: number;
  preview: string;
}

// Whitespace + Unicode-punctuation split — mirrors MiniSearch's default
// tokenizer (which already breaks `foo.bar`, `use_x`, `use-x`), but we wrap it
// to ALSO split camelCase.
const TOKEN_SPLIT = /[\n\r\p{Z}\p{P}]+/u;

// Identifier-aware tokenizer: splits camelCase into sub-words
// (`defineNitroPlugin` → `define`/`Nitro`/`Plugin`), so typing `plugin` reaches
// identifiers like `defineNitroPlugin` that never appear split in the prose.
//
// Emits ONLY the sub-words, not the joined compound: `combineWith: "AND"`
// requires every term to match, and the compound never appears verbatim, so
// keeping it would zero such queries. Splitting symmetrically at index/query
// time means a camelCase query matches the prose's sub-words. Shared by server
// and client — must be the exact same function (see note above).
export function tokenizeSearch(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(TOKEN_SPLIT)) {
    if (!raw) continue;
    const parts = raw.split(/(?<=[a-z0-9])(?=[A-Z])/).filter(Boolean);
    if (parts.length > 1) out.push(...parts);
    else out.push(raw);
  }
  return out;
}

export const MINISEARCH_OPTIONS: Options<SearchDocument> = {
  idField: "_id",
  // Indexed (searchable) fields — the FULL section text. `titles` (the breadcrumb
  // parents) is not indexed: it duplicates the parent page title, already here.
  fields: ["title", "content"],
  // Returned verbatim on every hit so the palette renders without a second lookup
  // — the real `id` to navigate to, plus the bounded `preview` for the snippet.
  // `content` is deliberately absent: indexed for search, never stored.
  storeFields: ["id", "title", "titles", "level", "preview"],
  tokenize: tokenizeSearch,
};

// Prepare sections for `MiniSearch.addAll`: assign the synthetic unique `_id`
// (its position in the list) and derive the bounded, stored `preview`. Server
// and client both index through this so the id/preview scheme is identical on
// both sides.
export function toSearchDocuments(sections: SearchSection[]): SearchDocument[] {
  return sections.map((section, _id) => ({
    ...section,
    _id,
    preview: (section.content || "").slice(0, PREVIEW_MAX),
  }));
}

// Query-time options (don't affect `loadJS` compatibility — free to tune, no
// rebuild). Tuned against a labelled query corpus over Nitro's docs (see
// `test/content/search-tuning.test.ts`); empirical and a good default, not a
// proof for every docs set — re-run the benchmark before pushing further.
export const MINISEARCH_SEARCH_OPTIONS: SearchOptions = {
  // Float page/heading title matches above body-text matches.
  boost: { title: 3 },
  // Gate prefix/fuzzy to longer terms: 1–2 char fragments prefix-match half the
  // corpus, and short words fuzz into unrelated ones — both are pure noise.
  prefix: (term) => term.length > 2,
  fuzzy: (term) => (term.length > 3 ? 0.2 : false),
  maxFuzzy: 4,
  combineWith: "AND",
  // Prefer exact/prefix evidence over fuzzy guesses when ranking.
  weights: { fuzzy: 0.3, prefix: 0.6 },
  // Lower `b` (length normalization) so long sections aren't over-penalized —
  // our sections carry the full prose under a heading and vary a lot in length.
  bm25: { k: 1.2, b: 0.5, d: 0.5 },
  // Nudge whole-page (level-1) sections above deep headings of equal text score,
  // so a query lands on the page rather than one of its sub-sections.
  boostDocument: (_id, _term, stored) => (stored && stored.level === 1 ? 1.6 : 1),
};

// Relaxed FALLBACK query options — used ONLY when the strict pass returns zero
// hits (see `DocsSearch.vue`). Trades precision for recall:
//   - `combineWith: "OR"` — one matching term is enough (vs. requiring all).
//   - `fuzzy`/`maxFuzzy` widened and gated a char shorter; `prefix: true`.
//   - `weights` lean harder on fuzzy/prefix since that's all we have.
// Ranking knobs are inherited unchanged. Query-time only, no `loadJS` impact.
export const MINISEARCH_FUZZY_SEARCH_OPTIONS: SearchOptions = {
  ...MINISEARCH_SEARCH_OPTIONS,
  combineWith: "OR",
  prefix: true,
  fuzzy: (term) => (term.length > 2 ? 0.4 : false),
  maxFuzzy: 6,
  weights: { fuzzy: 0.5, prefix: 0.7 },
};
