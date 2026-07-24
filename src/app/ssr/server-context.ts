/**
 * Per-request SSR context (server-only).
 *
 * The client is a single app instance, so `useAsyncData`/`useState` can safely
 * cache in module-level maps. On the server, one process renders many requests
 * concurrently — module-level caches would leak one request's page data (and
 * reactive refs mid-render) into another. This module gives each render its own
 * store via `AsyncLocalStorage`, which propagates across the `await`s inside
 * `renderToString` (async `<script setup>` + `<Suspense>`).
 *
 * SERVER-ONLY: imported exclusively by `entry-server.ts` (the `ssr` Vite env).
 * Composables never import it — they read the active store through the global
 * accessor installed below, but only inside `if (import.meta.server)` branches
 * that are dead-code-eliminated from the client bundle. So `node:async_hooks`
 * never reaches the browser.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { $Fetch } from "ofetch";

export interface UndocsServerContext {
  /** `useAsyncData` entries for this request (shape owned by `useAsyncData.ts`). */
  asyncData: Map<string, any>;
  /** `useState` refs for this request. */
  state: Map<string, any>;
  /** Request-scoped `$fetch` (loopback base URL = the incoming request origin). */
  fetch: $Fetch;
  /**
   * Icon names (`collection:name`) requested during this render. `Icon.vue`
   * registers each icon it renders here so `entry-server.ts` can preload the
   * data and re-render real SVGs (Iconify can't resolve its async API loads
   * within a single synchronous pass). See `ssr/icons.ts`.
   */
  icons: Set<string>;
  /**
   * Per-request auto-key counters. They MUST be per-request, not module-level:
   * a shared counter drifts across concurrent renders, so the generated key
   * (`$auto:N`/`$state:N`) would not match the fresh client's, breaking payload
   * seeding. Reset to 0 per request → aligned with the client's first render.
   */
  asyncAutoId: number;
  stateAutoId: number;
  /**
   * Prerender-only: the `/api/docs/*` URLs fetched during this render. Set to a
   * `Set` only when the incoming request is Nitro's prerenderer (it carries an
   * `x-nitro-prerender` header); `undefined` for live SSR so recording adds no
   * overhead there. `entry-server.ts` emits these as the response's own
   * `x-nitro-prerender` header so Nitro also bakes the content API the page
   * depends on. See `docFetch()` in `composables/useContent.ts`.
   */
  prerenderRoutes?: Set<string>;
}

const als = new AsyncLocalStorage<UndocsServerContext>();

// Installed on the shared server `globalThis` so the composables can reach the
// active store without importing this (node-only) module. See the note above.
(globalThis as any).__undocsServerCtx = () => als.getStore();

/** Run `fn` (the render) with `ctx` as the active per-request store. */
export function runWithServerContext<T>(ctx: UndocsServerContext, fn: () => T): T {
  return als.run(ctx, fn);
}

/**
 * Create an empty per-request context bound to a request-scoped `$fetch`.
 * Pass `prerender: true` (when the request is Nitro's prerenderer) to collect
 * the content-API URLs the render fetches into `prerenderRoutes`.
 */
export function createServerContext(fetch: $Fetch, prerender = false): UndocsServerContext {
  return {
    asyncData: new Map(),
    state: new Map(),
    fetch,
    icons: new Set(),
    asyncAutoId: 0,
    stateAutoId: 0,
    prerenderRoutes: prerender ? new Set() : undefined,
  };
}
