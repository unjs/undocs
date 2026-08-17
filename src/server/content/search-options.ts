// MiniSearch does not serialize options; server indexing and client rehydration
// must import this exact client-safe config or search silently corrupts.
import type { Options, SearchOptions } from "minisearch";
import type { SearchSection } from "./types.ts";

// Bounds stored snippets, not the full text indexed for ranking.
export const PREVIEW_MAX = 300;

// `_id` is synthetic because navigation IDs need not be unique; full content is not stored.
export interface SearchDocument extends SearchSection {
  _id: number;
  preview: string;
}

// Mirror MiniSearch's Unicode split before additionally splitting camelCase.
const TOKEN_SPLIT = /[\n\r\p{Z}\p{P}]+/u;

// Emit only camelCase subwords: retaining the compound would make AND queries
// require a token that prose does not contain. Used symmetrically for index/query.
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
  // Breadcrumb titles duplicate the indexed page title.
  fields: ["title", "content"],
  // Full content is indexed but omitted from each returned hit.
  storeFields: ["id", "title", "titles", "level", "preview"],
  tokenize: tokenizeSearch,
};

export function toSearchDocuments(sections: SearchSection[]): SearchDocument[] {
  return sections.map((section, _id) => ({
    ...section,
    _id,
    preview: (section.content || "").slice(0, PREVIEW_MAX),
  }));
}

// Query-time only. Re-run the labelled-corpus benchmark before retuning.
export const MINISEARCH_SEARCH_OPTIONS: SearchOptions = {
  boost: { title: 3 },
  // Prefix/fuzzy matching on short terms produces mostly noise.
  prefix: (term) => term.length > 2,
  fuzzy: (term) => (term.length > 3 ? 0.2 : false),
  maxFuzzy: 4,
  combineWith: "AND",
  weights: { fuzzy: 0.3, prefix: 0.6 },
  // Reduce the penalty for widely varying full-section lengths.
  bm25: { k: 1.2, b: 0.5, d: 0.5 },
  // Prefer whole pages over deep headings at equal text score.
  boostDocument: (_id, _term, stored) => (stored && stored.level === 1 ? 1.6 : 1),
};

// Zero-hit fallback trades precision for recall; query-time options do not affect rehydration.
export const MINISEARCH_FUZZY_SEARCH_OPTIONS: SearchOptions = {
  ...MINISEARCH_SEARCH_OPTIONS,
  combineWith: "OR",
  prefix: true,
  fuzzy: (term) => (term.length > 2 ? 0.4 : false),
  maxFuzzy: 6,
  weights: { fuzzy: 0.5, prefix: 0.7 },
};
