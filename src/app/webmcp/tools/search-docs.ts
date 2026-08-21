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
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import type { AppRouter } from "@app/router.ts";
import { getLocaleFromPath, isSameLocalePath, resolveI18nConfig } from "@app/utils/locale.ts";
import type { ModelContextTool } from "../types.ts";
import { arraySchema, objectSchema, PATH_PROPERTY } from "./schemas.ts";
import { clampLimit, siteName, textResult } from "./utils.ts";

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

/**
 * One hit, addressed the way the OTHER tools take input: a route path plus the
 * matched heading's anchor. `path` is `read_page`'s argument verbatim and
 * `hash` is `navigate`'s, so acting on a result is a copy rather than a parse —
 * where an absolute `https://origin/guide/deploy#vercel` is a link for a human
 * and makes the agent strip an origin back off (or, worse, fetch the rendered
 * HTML page instead of asking `read_page` for the Markdown).
 */
interface SearchHit {
  title: string;
  breadcrumb?: string;
  /** Route path of the page the section lives on, e.g. `/guide/deploy`. */
  path: string;
  /** Anchor of the matched heading, e.g. `#vercel`; absent on a page-level hit. */
  hash?: string;
  preview: string;
}

/** `SearchHit`, described for the agent — the two must stay in step. */
const SEARCH_HIT_SCHEMA = objectSchema(
  {
    title: { type: "string", description: "Title of the matched page or section." },
    breadcrumb: {
      type: "string",
      description:
        "Ancestor headings of the matched section, `>`-separated; absent on a page-level hit.",
    },
    path: PATH_PROPERTY,
    hash: {
      type: "string",
      description:
        "Anchor of the matched heading, e.g. `#vercel` — `navigate`'s `hash`; absent on a page-level hit.",
    },
    preview: {
      type: "string",
      description: "Excerpt of the section's text; an empty string when it has none.",
    },
  },
  ["title", "path", "preview"],
);

/**
 * The hits as one text block, so a client that unwraps `content` reads the
 * previews as prose instead of as JSON-escaped strings. This is DISPLAY text —
 * the structured copy beside it keeps every field verbatim, which is why a
 * preview's own line breaks can be collapsed here to keep one hit to one entry.
 *
 * The path line is relative for the same reason the fields are: it is the thing
 * an agent reading only the prose hands to the next tool call.
 */
function formatHits(query: string, hits: SearchHit[]): string {
  if (hits.length === 0) return `No results for "${query}".`;
  return hits
    .map((hit, i) => {
      const heading = hit.breadcrumb ? `${hit.breadcrumb} > ${hit.title}` : hit.title;
      const preview = hit.preview.replace(/\s+/g, " ").trim();
      const link = `${hit.path}${hit.hash ?? ""}`;
      return `${i + 1}. ${heading}\n   ${link}${preview ? `\n   ${preview}` : ""}`;
    })
    .join("\n\n");
}

export function searchDocsTool(router: AppRouter): ModelContextTool {
  return {
    name: "search_docs",
    title: "Search documentation",
    description:
      `Search pages and sections in ${siteName()}. Returns ranked matches with previews, ` +
      `route paths and optional heading anchors. Use \`read_page\` to read a result.`,
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
    // Describes `structuredContent`; the text block beside it is the same hits
    // rendered as prose (see `./schemas.ts`).
    outputSchema: objectSchema(
      {
        query: { type: "string", description: "The query as searched, trimmed." },
        count: {
          type: "integer",
          description: "Number of results returned, at most `limit`.",
        },
        results: arraySchema(SEARCH_HIT_SCHEMA, "Ranked matches, best first."),
      },
      ["query", "count", "results"],
    ),
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

      const docs = useAppConfig().docs as { lang?: string; i18n?: any };
      const i18nConfig = resolveI18nConfig(docs);
      const currentLocale = getLocaleFromPath(
        router.currentRoute.path,
        i18nConfig.localeCodes,
        i18nConfig.defaultLocale,
        i18nConfig.strategy,
      );

      const results: SearchHit[] = [];
      for (const hit of hits) {
        if (results.length >= clampLimit(limit, 10, 50)) break;
        const stored = hit as unknown as SearchDocument;
        const [path, hash = ""] = String(stored.id).split("#");
        if (
          !isSameLocalePath(
            path || "/",
            currentLocale,
            i18nConfig.localeCodes,
            i18nConfig.defaultLocale,
            i18nConfig.strategy,
            i18nConfig.enabled,
          )
        ) {
          continue;
        }
        results.push({
          title: stored.title,
          breadcrumb: (stored.titles || []).join(" > ") || undefined,
          path,
          hash: hash ? `#${hash}` : undefined,
          preview: stored.preview || "",
        });
      }

      // Previews are prose (up to `PREVIEW_MAX` of the section's own text), so
      // this result gets the text block too — the structured hits carry the
      // route path and anchor an agent acts on.
      return textResult(formatHits(q, results), {
        query: q,
        count: results.length,
        results,
      });
    },
  };
}
