/**
 * Minimal router for the reused `app/pages/*` — a from-scratch replacement for
 * vue-router. The app only ever used a tiny slice of vue-router (reactive
 * `route.path`/`hash`/`fullPath`/`meta`, a single imperative `push`, one
 * `<router-view>` and one `<router-link>`), so a purpose-built router is far
 * smaller.
 *
 * Surface:
 *   - `createAppRouter(history?)` → an installable router (`app.use(router)`).
 *   - `useRoute()` / `useRouter()` — the reactive route + the router instance.
 *   - `createWebHistory()` (browser) / `createMemoryHistory(start)` (SSR).
 *
 * Layouts are declared per route via `meta.layout` and resolved by `AppLayout`.
 * The `<router-view>` equivalent is `AppPage` (reads `router.component`); the
 * `<router-link>` equivalent is `AppLink`.
 */
import {
  type App,
  type Component,
  type Ref,
  type ShallowRef,
  inject,
  markRaw,
  nextTick,
  reactive,
  ref,
  shallowRef,
} from "vue";
import { pages as userPages } from "virtual:undocs/user-pages";
import { useAppConfig } from "@app/composables/useAppConfig";
import { normalizeRedirects, resolveRedirect } from "@app/utils/redirects";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteLocation {
  /** Pathname only, e.g. `/blog/post`. */
  path: string;
  /** Hash including `#`, or `""`. */
  hash: string;
  /** Search string including `?`, or `""`. */
  query: string;
  /** `path + query + hash` — the full location, used as a navigation identity. */
  fullPath: string;
  /** Route record metadata (currently just `{ layout }`). */
  meta: Record<string, unknown>;
}

/** A navigation target: an absolute path string or `{ path, hash? }`. */
export type RouteTarget = string | { path: string; hash?: string };

export interface RouterHistory {
  /** Current location as `path + query + hash`. */
  readonly location: string;
  push(to: string): void;
  replace(to: string): void;
  /** Subscribe to back/forward (popstate). Returns an unsubscribe fn. */
  listen(cb: (location: string) => void): () => void;
}

interface RouteRecord {
  /** Returns true when this record matches the given pathname. */
  match: (path: string) => boolean;
  component: () => Promise<Component | { default: Component }> | Component;
  meta: Record<string, unknown>;
}

export interface AppRouter {
  /** The reactive current route (same object returned by `useRoute()`). */
  readonly currentRoute: RouteLocation;
  /** The resolved component for the current route (read by `AppPage`). */
  readonly component: ShallowRef<Component | null>;
  /**
   * `true` while a client navigation's page is loading (drives the loading bar).
   * Deferred by `PENDING_BAR_DELAY` so quick navigations never flash the bar.
   */
  readonly pending: Ref<boolean>;
  push(to: RouteTarget): Promise<void>;
  replace(to: RouteTarget): Promise<void>;
  /** Resolves once the initial route's component has been resolved. */
  isReady(): Promise<void>;
  install(app: App): void;
  /** Internal: `AppPage`'s `<Suspense>` calls this on resolve to clear `pending`. */
  _pageRendered(): void;
}

// ---------------------------------------------------------------------------
// Histories
// ---------------------------------------------------------------------------

export function createWebHistory(): RouterHistory {
  const read = () => window.location.pathname + window.location.search + window.location.hash;
  const listeners = new Set<(loc: string) => void>();
  window.addEventListener("popstate", () => {
    for (const cb of listeners) cb(read());
  });
  return {
    get location() {
      return read();
    },
    push(to) {
      window.history.pushState({}, "", to);
    },
    replace(to) {
      window.history.replaceState({}, "", to);
    },
    listen(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

export function createMemoryHistory(start = "/"): RouterHistory {
  let current = start;
  return {
    get location() {
      return current;
    },
    push(to) {
      current = to;
    },
    replace(to) {
      current = to;
    },
    listen() {
      return () => {};
    },
  };
}

// ---------------------------------------------------------------------------
// Route table
//
// Order matters — first match wins: `/` and `/blog` are exact, `/blog/*` is
// the blog catch-all, and the trailing record catches the rest as a docs page.
// ---------------------------------------------------------------------------

// User `.docs/pages/**` routes (via the `undocs:user-theme` plugin), compiled
// from their emitted `RegExp` sources. Layered BEFORE the built-ins so a user
// page overrides a built-in route (e.g. a custom `index.vue` landing) and is
// reached before the docs catch-all. The plugin already ordered them exact →
// catch-all, so within the user layer the right record wins too.
const userRoutes: RouteRecord[] = userPages.map((p) => {
  const re = new RegExp(p.match);
  return {
    match: (path) => re.test(path),
    component: p.component,
    meta: p.meta,
  };
});

const routes: RouteRecord[] = [
  ...userRoutes,
  {
    match: (p) => p === "/",
    component: () => import("@app/pages/index.vue"),
    meta: {},
  },
  {
    match: (p) => p === "/blog",
    component: () => import("@app/pages/blog/index.vue"),
    meta: {},
  },
  {
    match: (p) => p.startsWith("/blog/"),
    component: () => import("@app/pages/blog/[...slug].vue"),
    meta: { layout: "blog" },
  },
  {
    match: () => true,
    component: () => import("@app/pages/[...slug].vue"),
    meta: { layout: "docs" },
  },
];

function matchRoute(path: string): RouteRecord {
  // The trailing record matches everything, so `find` always succeeds.
  return routes.find((r) => r.match(path))!;
}

// Docs-config redirects (`redirects: { "/old": "/new" }`). The SERVER is the
// primary enforcement point — `nitro.config.ts` turns the same map into route
// rules, so a direct hit is redirected before the app renders. This mirror only
// covers in-app navigation (`AppLink`), which never reaches the server and would
// otherwise land on the docs catch-all and 404.
const redirects = normalizeRedirects(useAppConfig().docs?.redirects);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseLocation(loc: string): Omit<RouteLocation, "meta"> {
  const url = new URL(loc, "http://undocs.local");
  return {
    path: url.pathname,
    hash: url.hash,
    query: url.search,
    fullPath: url.pathname + url.search + url.hash,
  };
}

function normalizeTarget(to: RouteTarget): string {
  if (typeof to === "string") return to;
  return to.path + (to.hash ?? "");
}

/**
 * Are we running in a browser? A real runtime check — NOT `import.meta.client`,
 * which is only statically replaced in the production build; in dev it survives
 * as `undefined` at runtime, so relying on it here would pick memory history on
 * the client (breaking hydration). History selection is a genuine runtime
 * concern, so probe the environment directly.
 */
const IS_BROWSER = typeof window !== "undefined";

/**
 * Grace period before a navigation flags `pending` (and thus shows the loading
 * bar). Navigations that resolve within this window — cached components, fast
 * dynamic imports — never flip `pending`, so the bar never flashes for the
 * common quick nav. Only a load slower than this reveals the bar.
 */
const PENDING_BAR_DELAY = 150;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const ROUTER_KEY = Symbol("undocs-router");
const ROUTE_KEY = Symbol("undocs-route");

/**
 * @param history Injected by the server entry as a memory history (per-request,
 *   seeded with the incoming URL). Defaults to the browser history on the client.
 */
export function createAppRouter(history?: RouterHistory): AppRouter {
  const hist = history ?? (IS_BROWSER ? createWebHistory() : createMemoryHistory());

  const route = reactive<RouteLocation>({
    path: "/",
    hash: "",
    query: "",
    fullPath: "/",
    meta: {},
  });
  const component = shallowRef<Component | null>(null);
  const pending = ref(false);

  // Deferred loading-bar timer (see `PENDING_BAR_DELAY`). A quick navigation
  // clears it before it fires, so `pending` — and the bar — never flips on.
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  function schedulePending() {
    clearPendingTimer();
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      pending.value = true;
    }, PENDING_BAR_DELAY);
  }
  function clearPendingTimer() {
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }
  function stopPending() {
    clearPendingTimer();
    pending.value = false;
  }

  // Resolved-component cache (dynamic-import modules are stable per record).
  const cache = new Map<RouteRecord, Component>();
  // Scroll offsets keyed by fullPath, for back/forward restoration. Kept current
  // by the `scroll` listener below — a pop offers no chance to record the
  // outgoing offset, since `popstate` fires with the location already changed.
  const scrollPositions = new Map<string, number>();
  // Where to land once the INCOMING page has actually rendered. Until its
  // `<Suspense>` resolves the document still holds the outgoing page, so a
  // restore offset would clamp against the wrong height and a `#hash` target
  // wouldn't exist yet. Consumed by `_pageRendered`.
  let pendingScroll: { hash: string; top?: number } | null = null;

  let navigated = false;
  let readyResolve!: () => void;
  const ready = new Promise<void>((r) => (readyResolve = r));

  // Monotonic id for the latest navigation. Each `navigate` captures its id and
  // bails after any `await` if a newer navigation has since started, so a rapid
  // second click can't let a slower, superseded navigation commit its route on
  // top of the newer one.
  let navToken = 0;

  async function resolveComponent(record: RouteRecord): Promise<Component> {
    const cached = cache.get(record);
    if (cached) return cached;
    const mod = await record.component();
    const comp = markRaw((mod as any).default ?? mod) as Component;
    cache.set(record, comp);
    return comp;
  }

  function applyState(parsed: Omit<RouteLocation, "meta">, record: RouteRecord, comp: Component) {
    route.path = parsed.path;
    route.hash = parsed.hash;
    route.query = parsed.query;
    route.fullPath = parsed.fullPath;
    route.meta = record.meta;
    component.value = comp;
  }

  function applyScroll(hash: string, top?: number) {
    if (!IS_BROWSER) return;
    // Hash anchors: `app.vue` also runs its own scroll-into-view retry loop for
    // async-rendered content; try an immediate scroll here too.
    if (hash) {
      // A hash is attacker/user-authorable and need not be a valid CSS selector
      // (`#foo bar`, `#~<payload>`), in which case `querySelector` THROWS and
      // would take the whole navigation down with it.
      try {
        document.querySelector(hash)?.scrollIntoView();
      } catch {
        // Not a selector — nothing to scroll to.
      }
      return;
    }
    window.scrollTo({ top: top ?? 0 });
  }

  async function navigate(
    loc: string,
    opts: { client?: boolean; pop?: boolean; savedScroll?: number } = {},
  ): Promise<void> {
    const token = ++navToken;

    // Cancel a not-yet-fired loading-bar timer from a superseded navigation, so
    // an abandoned nav can't flip the bar on after this one takes over.
    clearPendingTimer();

    let parsed = parseLocation(loc);

    // A configured redirect replaces the location before anything is matched.
    // An absolute target leaves the app entirely (full page load); a path is
    // swapped into history in place, so back/forward never returns to the old
    // URL. Self-redirects are ignored — they'd loop.
    const redirected = resolveRedirect(redirects, parsed.path);
    if (redirected !== undefined && redirected !== parsed.path) {
      const target = redirected + parsed.query + parsed.hash;
      if (/^[a-z][\d+.a-z-]*:/i.test(redirected)) {
        if (IS_BROWSER) window.location.replace(target);
        return;
      }
      hist.replace(target);
      parsed = parseLocation(target);
    }

    const record = matchRoute(parsed.path);

    // Same-path nav (active link, hash-only, breadcrumb-to-self) never re-renders
    // AppPage's <Suspense> (keyed by `route.path`), so `_pageRendered` — the only
    // thing that clears `pending` — would never fire, hanging the bar forever.
    // Handle it inline instead: update route/scroll and skip `pending`.
    const samePath = navigated && parsed.path === route.path;

    // Real client navigation: arm the loading bar. It's deferred by
    // `PENDING_BAR_DELAY` so a quick load never flashes it; a slow load trips
    // the timer and `_pageRendered` clears it once the <Suspense> resolves. The
    // initial route (`client: false`) never arms — it's SSR hydration.
    if (opts.client && !samePath) schedulePending();

    const comp = await resolveComponent(record);
    // A newer navigation started during the dynamic import; abandon this one so
    // it can't commit its route on top of the newer one.
    if (token !== navToken) return;

    applyState(parsed, record, comp);
    if (IS_BROWSER) await nextTick();
    // Same-path: <Suspense> isn't re-keyed, so no `resolve` event is coming and
    // nothing else would clear the loading bar. (A real path change re-keys it →
    // `_pageRendered`.)
    if (samePath) stopPending();

    // Scroll. Anything that needs the incoming page's DOM is queued for
    // `_pageRendered` instead of run here: the new page hasn't rendered yet, so
    // the document still has the OUTGOING page's height (a deep offset would
    // clamp, a `#hash` target wouldn't exist), and effects that fire on the new
    // render — the sidebar revealing its active entry, layout settling — would
    // otherwise move the viewport after us.
    if (samePath) {
      // Same page, so the DOM is already right — nothing to wait for.
      applyScroll(parsed.hash, opts.savedScroll);
    } else if (opts.pop) {
      // Back/forward: put the visitor back where they left this entry. With no
      // record of it (a fresh entry after a reload) leave scroll alone — the
      // browser's own restoration has already placed it.
      if (parsed.hash || opts.savedScroll !== undefined) {
        pendingScroll = { hash: parsed.hash, top: opts.savedScroll };
      }
    } else if (opts.client) {
      // Forward navigation: the top of the new page. Right away, because the
      // outgoing content is still on screen and waiting for the load would leave
      // the visitor stranded mid-page — then again once the page renders.
      pendingScroll = { hash: parsed.hash };
      if (!parsed.hash) applyScroll("");
    }
    // The initial route (`client: false`) is SSR hydration: leave the visitor's
    // scroll — and the browser's restore-on-reload — untouched.

    navigated = true;
    readyResolve();
  }

  if (IS_BROWSER) {
    // Track the current page's offset as it changes, so back/forward can restore
    // it in EITHER direction (`push` only ever sees the offset of the page being
    // left forwards). Passive + a single map write, so scrolling stays free.
    window.addEventListener(
      "scroll",
      () => {
        scrollPositions.set(route.fullPath, window.scrollY);
      },
      { passive: true },
    );

    hist.listen((loc) => {
      const saved = scrollPositions.get(parseLocation(loc).fullPath);
      void navigate(loc, { client: true, pop: true, savedScroll: saved });
    });
  }

  function push(to: RouteTarget): Promise<void> {
    const target = normalizeTarget(to);
    if (IS_BROWSER) scrollPositions.set(route.fullPath, window.scrollY);
    hist.push(target);
    return navigate(target, { client: true });
  }

  function replace(to: RouteTarget): Promise<void> {
    const target = normalizeTarget(to);
    hist.replace(target);
    return navigate(target, { client: true });
  }

  const router: AppRouter = {
    currentRoute: route,
    component,
    pending,
    push,
    replace,
    isReady() {
      if (!navigated) void navigate(hist.location, { client: false });
      return ready;
    },
    install(app: App) {
      app.provide(ROUTER_KEY, router);
      app.provide(ROUTE_KEY, route);
      app.config.globalProperties.$router = router;
      app.config.globalProperties.$route = route;
    },
    _pageRendered() {
      stopPending();
      const target = pendingScroll;
      pendingScroll = null;
      if (!target || !IS_BROWSER) return;
      // `resolve` fires with the new page patched in; one more tick lets the
      // effects it triggered (sidebar reveal, TOC) settle first, so ours is the
      // last word on where the viewport sits.
      void nextTick(() => applyScroll(target.hash, target.top));
    },
  };

  return router;
}

// ---------------------------------------------------------------------------
// Composables
// ---------------------------------------------------------------------------

export function useRouter(): AppRouter {
  const router = inject<AppRouter>(ROUTER_KEY);
  if (!router) throw new Error("[undocs] useRouter() called outside of a router-enabled app");
  return router;
}

export function useRoute(): RouteLocation {
  const route = inject<RouteLocation>(ROUTE_KEY);
  if (!route) throw new Error("[undocs] useRoute() called outside of a router-enabled app");
  return route;
}
