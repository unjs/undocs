/**
 * `search_docs` — full-text search over the docs, through the very MiniSearch
 * index the command palette uses.
 */
import MiniSearch from "minisearch";

import {
  MINISEARCH_OPTIONS,
  MINISEARCH_SEARCH_OPTIONS,
  MINISEARCH_FUZZY_SEARCH_OPTIONS,
} from "@server/content/search-options.ts";
import type { SearchDocument } from "@server/content/search-options.ts";

import { useAsyncData } from "@app/composables/useAsyncData.ts";
import { querySearchIndex } from "@app/composables/useContent.ts";
import type { ModelContextTool } from "../types.ts";
import { clampLimit, pageUrl, siteName, textResult } from "./utils.ts";

/**
 * The MiniSearch index, rehydrated once and memoized. Routed through the shared
 * `"search"` `useAsyncData` entry, so if the palette (or `prefetch.ts`) already
 * fetched the serialized index this resolves with no network at all.
 */
let indexPromise: Promise<MiniSearch<SearchDocument> | null> | undefined;

function searchIndex(): Promise<MiniSearch<SearchDocument> | null> {
  indexPromise ??= (async () => {
    const entry = await useAsyncData("search", () => querySearchIndex());
    if (entry.error.value || !entry.data.value) {
      await entry.refresh();
    }
    if (!entry.data.value) {
      indexPromise = undefined; // failed — let the next call retry
      return null;
    }
    return MiniSearch.loadJS<SearchDocument>(entry.data.value, MINISEARCH_OPTIONS);
  })();
  return indexPromise;
}

interface SearchHit {
  title: string;
  breadcrumb?: string;
  path: string;
  url: string;
  preview: string;
}

/**
 * The hits as one text block, so a client that unwraps `content` reads the
 * previews as prose instead of as JSON-escaped strings. This is DISPLAY text —
 * the structured copy beside it keeps every field verbatim, which is why a
 * preview's own line breaks can be collapsed here to keep one hit to one entry.
 */
function formatHits(query: string, hits: SearchHit[]): string {
  if (hits.length === 0) return `No results for "${query}".`;
  return hits
    .map((hit, i) => {
      const heading = hit.breadcrumb ? `${hit.breadcrumb} > ${hit.title}` : hit.title;
      const preview = hit.preview.replace(/\s+/g, " ").trim();
      return `${i + 1}. ${heading}\n   ${hit.url}${preview ? `\n   ${preview}` : ""}`;
    })
    .join("\n\n");
}

export function searchDocsTool(): ModelContextTool {
  return {
    name: "search_docs",
    title: "Search documentation",
    description:
      `Full-text search over ${siteName()}. Searches page and heading sections, ` +
      `returning the best matches with a text preview and a linkable URL. ` +
      `Use this first to find which page answers a question, then call ` +
      `\`read_page\` for the full text of a result.`,
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search terms, e.g. 'deploy to vercel' or 'defineNitroPlugin'.",
        },
        limit: {
          type: "integer",
          description: "Maximum number of results (1-50, default 10).",
          minimum: 1,
          maximum: 50,
        },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true },
    // The spec passes an object, but it's a draft behind flags — default the
    // destructure so a bare call fails with the tool's own error, not a
    // `TypeError` the agent can't act on. Same for the other tools.
    async execute({ query, limit } = {}) {
      const q = String(query ?? "").trim();
      if (!q) throw new Error("`query` is required.");

      const index = await searchIndex();
      if (!index) throw new Error("The search index could not be loaded.");

      // Strict pass first (all terms must match); fall back to the relaxed
      // typo-tolerant pass only when it finds nothing — same two-stage
      // strategy as the command palette, so agent and human search agree.
      let hits = index.search(q, MINISEARCH_SEARCH_OPTIONS);
      if (hits.length === 0) hits = index.search(q, MINISEARCH_FUZZY_SEARCH_OPTIONS);

      const results: SearchHit[] = hits.slice(0, clampLimit(limit, 10, 50)).map((hit) => {
        const stored = hit as unknown as SearchDocument;
        // Section ids are `path#slug` — the page plus the heading anchor.
        const [path, hash = ""] = String(stored.id).split("#");
        return {
          title: stored.title,
          breadcrumb: (stored.titles || []).join(" > ") || undefined,
          path,
          url: pageUrl(path, hash),
          preview: stored.preview || "",
        };
      });

      // Previews are prose (up to `PREVIEW_MAX` of the section's own text), so
      // this result gets the text block too — the structured hits carry the
      // linkable fields an agent acts on.
      return textResult(formatHits(q, results), {
        query: q,
        count: results.length,
        results,
      });
    },
  };
}
