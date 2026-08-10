/**
 * Client-side navigation prefetch.
 *
 * Because this is a client-rendered app, "prefetching the next page" does not
 * mean fetching HTML — it means warming the **`/api/docs/*` requests** a page
 * needs before the user clicks. A docs page's `<script setup>` awaits one
 * call, cached in the async-data store under a fixed key:
 *
 *   queryPage(path)      → key `kebabCase(path)`  (surround rides along in the payload)
 *
 * (see `pages/[...slug].vue`). If we resolve that exact key ahead of time,
 * the eventual `useAsyncData(sameKey, …)` finds a settled entry and returns it
 * instantly — no network round-trip, no loading bar. We reuse `useLazyAsyncData`
 * for this: it is idempotent (an existing key is returned as-is, never
 * refetched) and, with no `{ server: false }`, kicks the fetch off immediately.
 *
 * We walk the navigation tree from the top (the order the nav renders, so the
 * links a reader is most likely to reach first are warmed first), hold every
 * request back until the current page has finished loading its own resources
 * (see `whenPageIdle`), throttle the work through `requestIdleCallback` so it
 * never competes with the current page, and bail out entirely on mobile /
 * data-saver / slow connections where speculative traffic isn't worth the bytes
 * or battery.
 *
 * Client-only: the whole module runs from `app.vue`'s `onMounted`, so it never
 * executes during SSR. It still guards defensively (`typeof window`) and the
 * `queryPage` body is the same request-scoped `docFetch` used everywhere else.
 */
import { kebabCase } from "scule";
import { useLazyAsyncData } from "@app/composables/useAsyncData";
import { queryPage, querySearchIndex } from "@app/composables/useContent";
import type { NavItem } from "@server/content/types";

/** How many pages to warm at most, so a huge nav can't fan out unboundedly. */
const MAX_PREFETCH = 24;

/** This MUST mirror the key `pages/[...slug].vue` passes to `useAsyncData`. */
const pageKey = (path: string) => kebabCase(path);

/** A `requestIdleCallback` that degrades to a macrotask where unsupported. */
type IdleFn = (cb: () => void) => void;
function idle(): IdleFn {
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => void)
    | undefined;
  return ric ? (cb) => ric(cb, { timeout: 2000 }) : (cb) => setTimeout(cb, 200);
}

/** Quiet window (ms) the resource timeline must stay empty before we start. */
const QUIET_MS = 500;
/** Hard cap (ms) on the wait, so a chatty page never blocks prefetch forever. */
const MAX_WAIT_MS = 8000;

/**
 * Run `cb` once the page is done loading *its own* stuff.
 *
 * Two conditions, in order:
 *
 * 1. **`load`** — the initial resource set (scripts, styles, fonts, images).
 * 2. **A quiet resource timeline** — `load` is not the finish line for a
 *    hydrating SPA: the lazy chunks a page kicks off while mounting (the mermaid
 *    bundle is the fat one) are fetched with dynamic `import()`, which does not
 *    delay `load`. So after `load` we watch `PerformanceObserver`'s `resource`
 *    entries and only start once nothing new has been fetched for `QUIET_MS`.
 *
 * Otherwise up to `MAX_PREFETCH` speculative JSON requests pile into the
 * connection pool right as the real page is still pulling the code it needs to
 * render, and visibly delay it. `MAX_WAIT_MS` bounds the wait for pages with
 * long-lived background traffic (dev HMR, polling) that never truly goes quiet.
 */
function whenPageIdle(cb: () => void): void {
  let done = false;
  let quietTimer: ReturnType<typeof setTimeout> | undefined;
  let capTimer: ReturnType<typeof setTimeout> | undefined;
  let observer: PerformanceObserver | undefined;

  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(quietTimer);
    clearTimeout(capTimer);
    observer?.disconnect();
    cb();
  };

  const waitForQuiet = () => {
    const arm = () => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(finish, QUIET_MS);
    };
    capTimer = setTimeout(finish, MAX_WAIT_MS);
    try {
      observer = new PerformanceObserver(arm);
      observer.observe({ type: "resource", buffered: false });
    } catch {
      // No PerformanceObserver (or no `resource` entry type): the quiet timer
      // alone still gives the page a beat before we start.
    }
    arm();
  };

  if (document.readyState === "complete") {
    waitForQuiet();
  } else {
    window.addEventListener("load", waitForQuiet, { once: true });
  }
}

/**
 * Should we prefetch at all? Skip when the user is on a metered/slow link or a
 * mobile device — speculative fetches there cost data and battery for links
 * that may never be followed. `navigator.connection` is progressive: absent on
 * some browsers (treated as "fine to prefetch").
 */
function shouldPrefetch(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const conn = (navigator as any).connection;
  if (conn) {
    if (conn.saveData) return false; // explicit Data Saver
    if (/(^|-)2g$/.test(conn.effectiveType || "")) return false; // slow-2g / 2g
  }

  // Honor the reduced-data media preference.
  if (window.matchMedia?.("(prefers-reduced-data: reduce)").matches) return false;

  // Coarse mobile heuristic: prefer the UA-Client-Hint when present, else fall
  // back to a small, touch-first viewport.
  const uaMobile = (navigator as any).userAgentData?.mobile;
  const isMobile =
    typeof uaMobile === "boolean"
      ? uaMobile
      : (window.matchMedia?.("(max-width: 768px) and (pointer: coarse)").matches ?? false);
  if (isMobile) return false;

  return true;
}

/**
 * Flatten the nav tree into an ordered, de-duplicated list of page paths,
 * top-of-list first. Skips explicit non-pages (`page === false`) and hash/
 * external targets; keeps only in-app absolute paths.
 */
function collectPaths(nav: NavItem[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const walk = (items: NavItem[]) => {
    for (const item of items) {
      const path = item.path;
      if (
        item.page !== false &&
        typeof path === "string" &&
        path.startsWith("/") &&
        !seen.has(path)
      ) {
        seen.add(path);
        out.push(path);
      }
      if (item.children?.length) walk(item.children);
    }
  };

  walk(nav);
  return out;
}

/** Warm the page + surround cache entries for a single path (fire-and-forget). */
function warm(path: string): void {
  // `useLazyAsyncData` returns an existing entry untouched, so re-warming an
  // already-visited page is a no-op. Errors are swallowed inside the async-data
  // fetcher (it stores them on the entry), so nothing rejects here.
  useLazyAsyncData(pageKey(path), () => queryPage(path));
}

/**
 * Warm the global search index (`/api/docs/search`) under the shared "search"
 * async-data key, which `DocsSearch.vue`'s `loadIndex()` reads — so opening the
 * ⌘K palette finds the serialized index already fetched. Fired first once the
 * page is idle (not through the idle page queue), so it races the page warms in
 * parallel.
 */
function warmSearch(): void {
  useLazyAsyncData("search", () => querySearchIndex());
}

let started = false;

/**
 * Start prefetching next pages, driven by the navigation tree. Idempotent —
 * safe to call once from `app.vue`'s `onMounted`. `currentPath` (the freshly
 * rendered page) is skipped since it is already cached.
 */
export function startPrefetch(nav: NavItem[], currentPath?: string): void {
  if (started || !shouldPrefetch() || !nav?.length) return;
  started = true;

  const queue = collectPaths(nav)
    .filter((p) => p !== currentPath)
    .slice(0, MAX_PREFETCH);

  // Nothing goes out until the current page has finished loading its own
  // scripts/resources — including the chunks it lazy-loads while hydrating.
  whenPageIdle(() => {
    // Search index runs in parallel, right away — not queued behind the pages.
    warmSearch();

    const schedule = idle();
    const pump = () => {
      const next = queue.shift();
      if (next === undefined) return;
      warm(next);
      if (queue.length) schedule(pump); // one page per idle slot — gentle on the main page
    };

    schedule(pump);
  });
}
