/**
 * The content layer the docs tools read through: the navigation tree, one page,
 * "does this route exist?", and the shapes derived from them.
 *
 * Every lookup goes through the SAME `useAsyncData` entries the app itself uses,
 * so a warm cache (the SSR payload, `prefetch.ts`, the page the visitor is on)
 * is reused rather than refetched — with one exception, `probePage`, which is
 * the whole point of the cache-key invariant below.
 */
import { kebabCase } from "scule";
import { joinURL } from "ufo";

import type { DocPage, NavItem, TocLink } from "@server/content/types.ts";

import { useAsyncData } from "@app/composables/useAsyncData.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { queryNavigation, queryPage } from "@app/composables/useContent.ts";
import type { AppRouter } from "@app/router.ts";
import { pages as userPages } from "virtual:undocs/user-pages";
import { editUrl } from "../links.ts";
import { pageUrl, STANDALONE_ROUTES } from "./utils.ts";

/**
 * The navigation tree — served from the SSR payload's `useAsyncData` entry, so
 * this is a cache read, not a request.
 */
export async function navigation(): Promise<NavItem[]> {
  const entry = await useAsyncData("navigation", () => queryNavigation());
  return entry.data.value ?? [];
}

/**
 * One page — same `useAsyncData` key the docs page component uses
 * (`kebabCase(path)`), so the currently-rendered page is already cached here.
 *
 * ONLY for the visitor's OWN route. Proving an agent's path real is NOT enough
 * to earn this key — see `probePage`.
 */
export async function page(path: string): Promise<DocPage | null> {
  const entry = await useAsyncData(kebabCase(path), () => queryPage(path));
  return entry.data.value ?? null;
}

/**
 * Look a page up under a key of OUR own, for a path an agent supplied.
 *
 * `page()`'s key is lossy — `kebabCase` collapses `/guide/deploy`,
 * `/guide-deploy` and `/Guide/Deploy` onto one entry — and `queryPage` resolves
 * a 404 to `null` rather than throwing. Both halves of that poison the docs
 * page's cache, and a real path is no safer than a typo:
 *
 *   - A typo caches `null` under a REAL page's entry, so the visitor's next
 *     navigation there throws a fatal 404 on a page that exists.
 *   - A path that is real but COLLIDES (`/guide-deploy` when `/guide/deploy`
 *     also exists) caches the wrong page under the other's entry, so that
 *     navigation renders the wrong title, description and outline.
 *
 * Keyed by the raw path here, where a miss can only poison itself.
 */
export async function probePage(path: string): Promise<DocPage | null> {
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
export async function routeExists(path: string): Promise<boolean> {
  if (STANDALONE_ROUTES.has(path)) return true;
  if (USER_ROUTES.some((re) => re.test(path))) return true;
  if (flattenNav(await navigation()).some((p) => p.path === path)) return true;
  return Boolean(await probePage(path));
}

export interface FlatPage {
  title: string;
  path: string;
  description?: string;
}

/**
 * Depth-first list of every real page in the nav tree. A section with an index
 * page appears twice (as the `page` parent and as its own re-added first child),
 * hence the `seen` dedupe — same rule as `DocsSearch.vue`'s `flattenNav`.
 */
export function flattenNav(
  items: NavItem[],
  out: FlatPage[] = [],
  seen = new Set<string>(),
): FlatPage[] {
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
export function flattenToc(
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
 * The links that belong on every page result: where to read it as Markdown and
 * where to edit it. `editUrl` needs the page's content id, so it's absent for
 * routes with no content-index entry (the landing page, the blog listing).
 */
export function pageLinks(path: string, doc: DocPage | null) {
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
 * Snapshot of the page the visitor is looking at right now. Routes with no
 * content-index entry (`STANDALONE_ROUTES`) still have a rendered `<title>` —
 * use it rather than reporting an empty page.
 */
export async function currentPage(router: AppRouter) {
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
