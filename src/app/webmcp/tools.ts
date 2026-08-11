/**
 * The docs tools we hand to a WebMCP agent.
 *
 * Every tool is a thin wrapper over machinery the page already owns — the
 * MiniSearch index the command palette loads, the `/api/docs/*` data cached in
 * `useAsyncData`, the router — so an agent driving the page sees exactly what a
 * visitor sees, and warm caches are reused rather than refetched.
 *
 * CLIENT-ONLY: this module is dynamically imported from `main.ts` after mount
 * and never evaluated during SSR.
 */
import MiniSearch from "minisearch";
import { $fetch } from "ofetch";
import { kebabCase } from "scule";
import { joinURL, withLeadingSlash, withoutTrailingSlash } from "ufo";

import {
  MINISEARCH_OPTIONS,
  MINISEARCH_SEARCH_OPTIONS,
  MINISEARCH_FUZZY_SEARCH_OPTIONS,
} from "@server/content/search-options";
import type { SearchDocument } from "@server/content/search-options";
import type { DocPage, NavItem, TocLink } from "@server/content/types";

import { useAsyncData } from "@app/composables/useAsyncData";
import { useAppConfig } from "@app/composables/useAppConfig";
import { queryNavigation, queryPage, querySearchIndex } from "@app/composables/useContent";
import type { AppRouter } from "@app/router";
import { pages as userPages } from "virtual:undocs/user-pages";
import { editUrl, repoLinks, socialLinks } from "./links";
import type { ModelContextTool } from "./types";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Cap on the Markdown one `read_page` call returns, so a long page can't fill an
 * agent's whole context in one go. Not a hard limit on what it can read: the
 * result carries a `nextOffset` cursor for the remainder (and `markdownUrl` /
 * `llms-full.txt` for an agent that would rather fetch the text itself).
 */
const MARKDOWN_MAX = 40_000;

/**
 * Routes that exist without a page in the content index, so an "is this a real
 * page?" check must not go by `queryPage` alone: the landing page is built from
 * `landing` config (most docs sets have no root `index.md`, and `/api/docs/page/
 * _index.json` 404s there) and `/blog` is a generated listing. Both are route
 * records in `router.ts`.
 */
const STANDALONE_ROUTES = new Set(["/", "/blog"]);

/**
 * Coerce whatever an agent passed into a docs route path. Models routinely hand
 * back a full URL they saw in an earlier result, a `.md` source path, or a path
 * with a trailing slash — all of which should resolve to the same page.
 */
function normalizePath(input: unknown): string {
  let path = String(input ?? "").trim();
  if (!path) return "/";
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      // Not parseable as a URL — fall through and treat it as a path.
    }
  }
  path = path
    .split("#")[0]
    .split("?")[0]
    .replace(/\.(md|html)$/i, "");
  path = withLeadingSlash(path);
  return path === "/" ? "/" : withoutTrailingSlash(path);
}

/** Absolute URL for a route path, so results are directly linkable. */
function pageUrl(path: string, hash = ""): string {
  const origin = typeof location === "undefined" ? "" : location.origin;
  return `${origin}${path}${hash ? `#${hash}` : ""}`;
}

/** Clamp an agent-supplied count into a sane range. */
function clampLimit(value: unknown, fallback: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/** Clamp an agent-supplied character offset to a non-negative integer. */
function clampOffset(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * The navigation tree — served from the SSR payload's `useAsyncData` entry, so
 * this is a cache read, not a request.
 */
async function navigation(): Promise<NavItem[]> {
  const entry = await useAsyncData("navigation", () => queryNavigation());
  return entry.data.value ?? [];
}

/**
 * One page — same `useAsyncData` key the docs page component uses
 * (`kebabCase(path)`), so the currently-rendered page is already cached here.
 *
 * ONLY for a path already known to be real: the visitor's own route, or one
 * `routeExists` has cleared. For anything an agent typed, use `probePage`.
 */
async function page(path: string): Promise<DocPage | null> {
  const entry = await useAsyncData(kebabCase(path), () => queryPage(path));
  return entry.data.value ?? null;
}

/**
 * Look a page up under a key of OUR own, for a path an agent supplied.
 *
 * `page()`'s key is lossy — `kebabCase` collapses `/guide/deploy`,
 * `/guide-deploy` and `/Guide/Deploy` onto one entry — and `queryPage` resolves
 * a 404 to `null` rather than throwing. So probing an agent's typo through that
 * key would cache `null` under a REAL page's entry, and the visitor's next
 * navigation there would read the poisoned entry and throw a fatal 404 on a page
 * that exists. Keyed by the raw path here, where a miss can only poison itself.
 */
async function probePage(path: string): Promise<DocPage | null> {
  const entry = await useAsyncData(`webmcp:probe:${path}`, () => queryPage(path));
  return entry.data.value ?? null;
}

/** User `.docs/pages/**` routes, matched exactly as `router.ts` matches them. */
const USER_ROUTES = userPages.map((p) => new RegExp(p.match));

/**
 * Does the router resolve `path` to a real page? Cheapest check first: the
 * generated standalone routes, then the user's own pages (which have no
 * content-index entry either), then the nav tree — all cache reads — and only
 * then a probe request, for a page the nav doesn't list.
 */
async function routeExists(path: string): Promise<boolean> {
  if (STANDALONE_ROUTES.has(path)) return true;
  if (USER_ROUTES.some((re) => re.test(path))) return true;
  if (flattenNav(await navigation()).some((p) => p.path === path)) return true;
  return Boolean(await probePage(path));
}

interface FlatPage {
  title: string;
  path: string;
  description?: string;
}

/**
 * Depth-first list of every real page in the nav tree. A section with an index
 * page appears twice (as the `page` parent and as its own re-added first child),
 * hence the `seen` dedupe — same rule as `DocsSearch.vue`'s `flattenNav`.
 */
function flattenNav(items: NavItem[], out: FlatPage[] = [], seen = new Set<string>()): FlatPage[] {
  for (const item of items || []) {
    if (item.page && item.path && !seen.has(item.path)) {
      seen.add(item.path);
      out.push({
        title: item.title,
        path: item.path,
        description: item.description || undefined,
      });
    }
    if (item.children) flattenNav(item.children, out, seen);
  }
  return out;
}

/** Flatten a page's TOC into `{ text, hash, depth }` rows an agent can link to. */
function flattenToc(
  links: TocLink[] = [],
  out: Array<{ text: string; hash: string; depth: number }> = [],
): Array<{ text: string; hash: string; depth: number }> {
  for (const link of links) {
    out.push({ text: link.text, hash: `#${link.id}`, depth: link.depth });
    if (link.children) flattenToc(link.children, out);
  }
  return out;
}

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
 * The links that belong on every page result: where to read it as Markdown and
 * where to edit it. `editUrl` needs the page's content id, so it's absent for
 * routes with no content-index entry (the landing page, the blog listing).
 */
function pageLinks(path: string, doc: DocPage | null) {
  const docs = useAppConfig().docs || {};
  return {
    url: pageUrl(path),
    // `/raw/**` is served from the content index, so a route with no entry there
    // (the landing page, the blog listing) has no Markdown source to link to —
    // `/raw/.md` would 404. Omit it rather than hand an agent a dead link.
    markdownUrl: doc ? pageUrl(joinURL("/raw", `${path}.md`)) : undefined,
    editUrl: editUrl(docs.github, docs.branch, doc?.id),
  };
}

/**
 * The `versions` config as linkable entries. Its `to` is whatever the docs
 * author wrote — usually another site, but it may be a relative path, and every
 * other tool hands back absolute URLs.
 */
function docsVersions(versions: unknown) {
  if (!Array.isArray(versions) || versions.length === 0) return undefined;
  return versions
    .filter((v) => v && typeof v === "object")
    .map((v: { label?: string; to?: string; active?: boolean }) => ({
      label: v.label,
      url:
        typeof v.to === "string" && /^https?:\/\//i.test(v.to)
          ? v.to
          : pageUrl(withLeadingSlash(String(v.to ?? "/"))),
      active: v.active || undefined,
    }));
}

/**
 * The "nothing to read here" error. `/` and `/blog` are real routes an agent
 * will have seen in a result, but they're generated — no content-index entry,
 * so no `/raw` source. A bare "not found" would read as a broken link instead
 * of "this page exists, it just isn't written in Markdown".
 */
function noSourceError(path: string): Error {
  if (!STANDALONE_ROUTES.has(path)) {
    return new Error(`No documentation page at \`${path}\`.`);
  }
  return new Error(
    `\`${path}\` is generated, not written in Markdown, so it has no source to read. ` +
      `Use \`list_pages\` for the pages that do` +
      (path === "/" ? ", or `get_project_info` for the project's links." : "."),
  );
}

/**
 * Snapshot of the page the visitor is looking at right now. Routes with no
 * content-index entry (`STANDALONE_ROUTES`) still have a rendered `<title>` —
 * use it rather than reporting an empty page.
 */
async function currentPage(router: AppRouter) {
  const path = router.currentRoute.path;
  const doc = await page(path);
  const rendered = (typeof document !== "undefined" && document.title) || "";
  return {
    path,
    ...pageLinks(path, doc),
    // The visitor's own anchor, which `pageLinks` (page-level) doesn't carry.
    url: pageUrl(path, router.currentRoute.hash.replace(/^#/, "")),
    title: doc?.title || rendered,
    // A generated route has no description of its own; the site's stands in so
    // the agent gets context rather than an empty field.
    description: doc ? doc.description || "" : useAppConfig().site?.description || "",
    headings: flattenToc(doc?.body?.toc?.links),
  };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export function createDocsTools(router: AppRouter): ModelContextTool[] {
  const appConfig = useAppConfig();
  const siteName = appConfig.site?.name || appConfig.docs?.name || "this documentation site";

  return [
    {
      name: "search_docs",
      title: "Search documentation",
      description:
        `Full-text search over ${siteName}. Searches page and heading sections, ` +
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
      // Results embed docs prose, which for most projects is community-authored
      // — flag it so the agent treats it as data, never as instructions.
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      // The spec passes an object, but it's a draft behind flags — default the
      // destructure so a bare call fails with the tool's own error, not a
      // `TypeError` the agent can't act on. Same for the other tools below.
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

        const results = hits.slice(0, clampLimit(limit, 10, 50)).map((hit) => {
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

        return { query: q, count: results.length, results };
      },
    },

    {
      name: "list_pages",
      title: "List documentation pages",
      description:
        `List every page of ${siteName} in navigation order, with its route ` +
        `path and description. Use this to get an overview of what the docs ` +
        `cover; use \`search_docs\` when you have a specific question.`,
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute() {
        const pages = flattenNav(await navigation());
        return {
          site: { name: appConfig.site?.name, description: appConfig.site?.description },
          count: pages.length,
          pages: pages.map((p) => ({ ...p, url: pageUrl(p.path) })),
        };
      },
    },

    {
      name: "get_project_info",
      title: "Get project info and links",
      description:
        `Return metadata and canonical links for ${siteName}: the source ` +
        `repository, issue tracker, releases, social/community links, the ` +
        `\`llms.txt\` bundles, and any documented versions. Use this when the ` +
        `user asks where to file a bug, find the source, or reach the project.`,
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute() {
        const docs = appConfig.docs || {};
        return {
          site: {
            name: appConfig.site?.name,
            description: appConfig.site?.description,
            url: appConfig.site?.url || pageUrl("/"),
          },
          repository: repoLinks(docs.github, docs.branch),
          links: socialLinks(docs.socials),
          // The plain-text bundles of this same content, for an agent that would
          // rather ingest the whole corpus than call `read_page` per page.
          llms: {
            index: pageUrl("/llms.txt"),
            full: pageUrl("/llms-full.txt"),
          },
          versions: docsVersions(docs.versions),
        };
      },
    },

    {
      name: "read_page",
      title: "Read a documentation page",
      description:
        `Return the Markdown source of one documentation page, given its route ` +
        `path (e.g. '/guide/getting-started'). Paths come from \`search_docs\`, ` +
        `\`list_pages\` or \`get_current_page\`. A long page comes back ` +
        `truncated with a \`nextOffset\` — call again with that \`offset\` for ` +
        `the rest. Generated routes (the landing page, the blog listing) have no ` +
        `Markdown source.`,
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Route path of the page, e.g. '/guide/getting-started'.",
          },
          offset: {
            type: "integer",
            description:
              "Character offset to read from — pass the `nextOffset` of a truncated result to continue (default 0).",
            minimum: 0,
          },
        },
        required: ["path"],
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute({ path: input, offset } = {}) {
        const path = normalizePath(input);
        // `/raw/**` serves the page's source markdown (frontmatter stripped,
        // title/description ensured) — the same text `llms.txt` links to.
        let markdown: string;
        try {
          markdown = await $fetch<string, "text">(joinURL("/raw", `${path}.md`), {
            responseType: "text",
          });
        } catch (error: any) {
          const status = error?.statusCode ?? error?.response?.status;
          if (status === 404) throw noSourceError(path);
          throw error;
        }

        // Long pages are handed over in `MARKDOWN_MAX` slices: `nextOffset` is
        // the cursor for the remainder, so truncation is a pause, not a dead end.
        const start = Math.min(clampOffset(offset), markdown.length);
        const slice = markdown.slice(start, start + MARKDOWN_MAX);
        const end = start + slice.length;

        // The path came back 200 from `/raw`, so it's real — safe to share the
        // docs page's cache key (see `page`).
        const doc = await page(path);
        return {
          path,
          ...pageLinks(path, doc),
          title: doc?.title ?? "",
          description: doc?.description ?? "",
          length: markdown.length,
          offset: start,
          truncated: end < markdown.length,
          nextOffset: end < markdown.length ? end : undefined,
          markdown: slice,
        };
      },
    },

    {
      name: "get_current_page",
      title: "Get the current page",
      description:
        `Return the documentation page the user is currently viewing: its route ` +
        `path, URL, title, description and heading outline. Use this to ground ` +
        `answers in what the user is actually looking at.`,
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => currentPage(router),
    },

    {
      name: "navigate",
      title: "Open a documentation page",
      description:
        `Navigate the browser tab to a documentation page, optionally scrolling ` +
        `to a heading anchor. This changes what the user sees — only use it when ` +
        `the user asked to be taken somewhere. To READ a page without moving ` +
        `them, use \`read_page\`.`,
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Route path to open, e.g. '/guide/getting-started'.",
          },
          hash: {
            type: "string",
            description: "Optional heading anchor to scroll to, e.g. '#installation'.",
          },
        },
        required: ["path"],
      },
      // The result embeds the landed page's title/description/outline — the same
      // docs prose every other tool flags.
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute({ path: input, hash } = {}) {
        const path = normalizePath(input);
        // Refuse dead links rather than dumping the visitor on a 404 page.
        if (!(await routeExists(path))) {
          throw new Error(`No documentation page at \`${path}\`.`);
        }

        const anchor = hash ? `#${String(hash).replace(/^#/, "")}` : "";
        await router.push({ path, hash: anchor || undefined });
        return { navigated: true, ...(await currentPage(router)) };
      },
    },
  ];
}
