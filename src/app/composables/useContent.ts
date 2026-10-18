import { $fetch } from "ofetch";
import type { AsPlainObject } from "minisearch";
import { createError, type AppError } from "@app/composables/createError.ts";
import type { DocPage, NavItem } from "@server/content/types.ts";
import type { PageSuggestion, Suggestions } from "@server/content/suggest.ts";

/**
 * The `$fetch` to use for `/api/docs/*`. These are relative, same-origin URLs.
 * In the browser plain `ofetch` resolves them against the current origin. During
 * SSR there is no origin, so `entry-server.ts` puts a request-scoped `$fetch`
 * (base URL = the incoming request's origin) on the per-request context; we use
 * it here for a same-server loopback, preserving the "data flows over HTTP"
 * boundary. The `import.meta.server` branch is dead-code-eliminated on the client.
 */
export function docFetch(): typeof $fetch {
  if (import.meta.server) {
    const ctx = (globalThis as any).__undocsServerCtx?.();
    if (ctx?.fetch) {
      const base = ctx.fetch as typeof $fetch;
      // During prerender, record query-less routes fetched here so `entry-server.ts`
      // can hint them for prerendering. Nitro can't write a route with a query string
      // to disk, so param-having routes (e.g. `page?path=`) are skipped.
      // `prerenderRoutes` is unset on live SSR, so this is a no-op there.
      return ctx.prerenderRoutes ? recordingFetch(base, ctx.prerenderRoutes) : base;
    }
  }
  return $fetch;
}

/**
 * Wrap a `$fetch` so every param-less string-URL call records its path into
 * `sink` — but only once it resolves 2xx. Recording after success (not before)
 * keeps a route that errors out of the prerender hints: e.g. `queryPage("/")`
 * on a docs set with no root `index.md` 404s, and we must not then bake a 404.
 * We copy the static props (`raw`/`native`/`create`) so the return stays a
 * drop-in `$fetch`. (The `.then` runs as a microtask when the fetch settles —
 * before `renderToString` resolves and `entry-server.ts` reads the sink.)
 */
function recordingFetch(base: typeof $fetch, sink: Set<string>): typeof $fetch {
  const wrapped = ((request: any, opts?: any) => {
    const result = base(request, opts);
    if (typeof request === "string" && isEmptyParams(opts?.params)) {
      Promise.resolve(result).then(
        () => sink.add(request),
        () => {},
      );
    }
    return result;
  }) as typeof $fetch;
  return Object.assign(wrapped, base);
}

function isEmptyParams(params: unknown): boolean {
  return (
    !params || Object.values(params as Record<string, unknown>).every((v) => v == null || v === "")
  );
}

/**
 * Add a route to this render's prerender hints — for routes the render
 * references but does NOT fetch, so `recordingFetch` can't see them (e.g. the OG
 * image `<meta og:image>` URL). `entry-server.ts` emits the collected set as the
 * `x-nitro-prerender` response header. No-op in the browser and in live SSR
 * (the sink is only set on prerender requests); the server-only body is
 * dead-code-eliminated from the client bundle.
 */
export function hintPrerenderRoute(route: string): void {
  if (!import.meta.server) return;
  const ctx = (globalThis as any).__undocsServerCtx?.();
  ctx?.prerenderRoutes?.add(route);
}

/** Fetch a single page by route path. Returns null on 404. */
export async function queryPage(path: string): Promise<DocPage | null> {
  // Path-addressed + param-less so `recordingFetch` records it for prerendering.
  // The root maps to `_index` (the OG-card convention); the `.json` suffix lets a
  // top-level page file coexist with the directory a nested page needs on disk.
  const slug = path === "/" ? "_index" : path.replace(/^\//, "");
  try {
    return await docFetch()<DocPage>(`/api/docs/page/${slug}.json`);
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.response?.status === 404) return null;
    throw error;
  }
}

/** What a 404 should become; `/api/docs/suggest/*` documents the tiers. */
export function querySuggestions(path: string): Promise<Suggestions> {
  const slug = path === "/" ? "_index" : path.replace(/^\//, "");
  return docFetch()<Suggestions>(`/api/docs/suggest/${slug}.json`);
}

/** `error.vue`'s `data` for a 404 that has somewhere better to point. */
export interface NotFoundData {
  path: string;
  suggestions: PageSuggestion[];
}

/**
 * The error a page throws when `path` has no page: a redirect when the server
 * is confident what was meant, a 404 carrying the candidates otherwise.
 *
 * Fetched outside `useAsyncData` on purpose. The path is whatever the visitor
 * (usually an agent) typed, so a cache entry per guess would only accumulate —
 * and none is needed: the server renders the error page from the thrown
 * error's `data`, which the payload carries to hydration as-is.
 */
export async function pageNotFound(path: string): Promise<Error & AppError<NotFoundData>> {
  const suggestions = await querySuggestions(path).catch(() => undefined);
  if (suggestions?.redirect && suggestions.redirect.split("#")[0] !== path) {
    return createError({ statusCode: 302, redirect: suggestions.redirect, fatal: true });
  }
  return createError({
    statusCode: 404,
    statusMessage: "Page not found",
    message: `${path} does not exist`,
    fatal: true,
    data: { path, suggestions: suggestions?.results ?? [] },
  });
}

export function queryNavigation(): Promise<NavItem[]> {
  return docFetch()<NavItem[]>("/api/docs/navigation.json");
}

/**
 * The serialized MiniSearch index (`MiniSearch.toJSON()`), built server-side.
 * Callers rehydrate it with `MiniSearch.loadJS(data, MINISEARCH_OPTIONS)`.
 * Param-less path so `recordingFetch` records it for prerendering.
 */
export function querySearchIndex(): Promise<AsPlainObject> {
  return docFetch()<AsPlainObject>("/api/docs/search.json");
}

/**
 * The `/blog/` listing, newest-first. A fixed, param-less path (so
 * `recordingFetch` records it for prerendering, like navigation/search).
 */
export function queryBlog(): Promise<
  Array<{ path: string; title: string; description: string; meta: Record<string, any> }>
> {
  return docFetch()("/api/docs/blog.json");
}
