/**
 * `useAsyncData` / `useLazyAsyncData` / `refreshAppData` — SSR-aware.
 *
 * A minimal async-data primitive (based on Nuxt), enough to make the pages/components run against
 * the Nitro `/api/docs/*` routes with SSR + hydration:
 *
 * - On the SERVER each request owns its own store (`server-context.ts` via
 *   AsyncLocalStorage), so concurrent renders never share reactive refs or leak
 *   one page's data into another. Resolved results are serialized into the
 *   hydration payload by `entry-server.ts`.
 * - On the CLIENT a single module-level store is used (one app instance).
 *   `hydrateAsyncData()` seeds it from the server payload BEFORE mount, so awaited
 *   `useAsyncData` calls resolve instantly with the server's data — no refetch, no
 *   hydration mismatch.
 *
 * `{ server: false }` is honored: the fetch is skipped during SSR (the key is not
 * added to the payload) and runs on the client — for client-only data (search
 * index, external sponsor/contributor APIs). On the client the fetch is deferred
 * until after hydration (`onMounted`) and is NOT awaited by the returned promise,
 * so the first (hydration) render matches the server's data-less DOM and `data`
 * fills in reactively afterwards. Starting/awaiting the fetch before the mount
 * commits would render data the server never produced and trip a hydration
 * mismatch (the shared parent `<Suspense>` makes even an un-awaited synchronous
 * fetch a race against the commit).
 *
 * Results are cached by key so repeat calls (and `refreshAppData`) share the same
 * reactive refs.
 */
import { getCurrentInstance, onMounted, ref, type Ref } from "vue";

export type AsyncDataStatus = "idle" | "pending" | "success" | "error";

export interface AsyncData<T> {
  data: Ref<T | null>;
  pending: Ref<boolean>;
  error: Ref<unknown>;
  status: Ref<AsyncDataStatus>;
  refresh: () => Promise<void>;
}

interface AsyncDataOptions<T> {
  /** Default value (or factory) used before resolution and on error. */
  default?: T | (() => T);
  /** When `false`, skip the fetch during SSR and run it on the client instead. */
  server?: boolean;
  lazy?: boolean;
  [key: string]: any;
}

interface AsyncDataEntry {
  refs: AsyncData<any>;
  promise: Promise<void>;
}

/** CLIENT store (single app). The SERVER store lives on the per-request context. */
const clientStore = new Map<string, AsyncDataEntry>();
let clientAutoKeyId = 0;

/** The active store: per-request on the server, module-level on the client. */
function store(): Map<string, AsyncDataEntry> {
  if (import.meta.server) {
    const ctx = (globalThis as any).__undocsServerCtx?.();
    if (ctx) return ctx.asyncData as Map<string, AsyncDataEntry>;
  }
  return clientStore;
}

/** Next auto key. Per-request on the server (aligned with the client's fresh
 *  counter), module-level on the client. See `server-context.ts`. */
function nextAutoKey(): string {
  if (import.meta.server) {
    const ctx = (globalThis as any).__undocsServerCtx?.();
    if (ctx) return `$auto:${ctx.asyncAutoId++}`;
  }
  return `$auto:${clientAutoKeyId++}`;
}

function resolveDefault<T>(opts: AsyncDataOptions<T> | undefined): T | null {
  if (!opts || opts.default === undefined) return null;
  return typeof opts.default === "function" ? (opts.default as () => T)() : opts.default;
}

/**
 * Parse the two supported call shapes:
 *   useAsyncData(key, fn, opts?)
 *   useAsyncData(fn, opts?)          // key auto-generated
 *
 * Auto keys are order-based, so the server and client generate the SAME key for
 * the same call site (render order matches) — payload seeding stays aligned.
 */
function parseArgs<T>(
  a: string | (() => Promise<T> | T),
  b?: (() => Promise<T> | T) | AsyncDataOptions<T>,
  c?: AsyncDataOptions<T>,
): { key: string; fn: () => Promise<T> | T; opts: AsyncDataOptions<T> } {
  if (typeof a === "function") {
    return { key: nextAutoKey(), fn: a, opts: (b as AsyncDataOptions<T>) || {} };
  }
  return { key: a, fn: b as () => Promise<T> | T, opts: c || {} };
}

/** A fetcher bound to a specific `refs` set. Extracted so `refresh` can be
 *  re-wired onto payload-seeded entries. */
function makeRun<T>(
  refs: AsyncData<any>,
  fn: () => Promise<T> | T,
  opts: AsyncDataOptions<T>,
): () => Promise<void> {
  return async () => {
    refs.pending.value = true;
    refs.status.value = "pending";
    try {
      const result = await fn();
      refs.data.value = result;
      refs.error.value = null;
      refs.status.value = "success";
    } catch (error) {
      // Do NOT rethrow: callers inspect `data.value` (e.g. `if (!page.value)`)
      // and decide whether to `throw createError(...)` themselves.
      refs.error.value = error;
      refs.data.value = resolveDefault(opts);
      refs.status.value = "error";
    } finally {
      refs.pending.value = false;
    }
  };
}

function getOrCreateEntry<T>(
  key: string,
  fn: () => Promise<T> | T,
  opts: AsyncDataOptions<T>,
): AsyncDataEntry {
  const existing = store().get(key);
  if (existing) {
    // Re-wire `refresh` to the latest fetcher so `refreshAppData` (dev
    // live-reload) works even for entries seeded from the hydration payload.
    existing.refs.refresh = makeRun(existing.refs, fn, opts);
    return existing;
  }

  // `{ server: false }`: skipped on the server; on the client, deferred to
  // `onMounted` and NOT awaited by `entry.promise`, so the first client render
  // uses the default value (matching the server's data-less DOM) and `data`
  // fills in reactively after mount. Starting the fetch any earlier risks
  // winning the race against the shared parent `<Suspense>`'s commit, which
  // would render data the server never produced → hydration mismatch.
  //
  // Use `!import.meta.server`, not `import.meta.client`: in dev Vite doesn't
  // apply the `client` define to browser modules, leaving it `undefined` there.
  const skipOnServer = import.meta.server && opts.server === false;
  const deferOnClient = !import.meta.server && opts.server === false;

  const refs: AsyncData<T> = {
    data: ref(resolveDefault(opts)) as Ref<T | null>,
    pending: ref(!skipOnServer),
    error: ref(null),
    status: ref<AsyncDataStatus>("idle"),
    refresh: async () => {},
  };
  const run = makeRun(refs, fn, opts);
  refs.refresh = run;

  let promise: Promise<void>;
  if (skipOnServer) {
    // Skipped-on-server entries resolve immediately with the default value.
    promise = Promise.resolve();
  } else if (deferOnClient) {
    // Resolve the awaitable now; run the fetch after hydration/mount. If we're not
    // in a component setup (no instance to hook), fall back to a macrotask, which
    // still lands after the synchronous hydration commit.
    if (getCurrentInstance()) {
      onMounted(() => void run());
    } else {
      setTimeout(() => void run(), 0);
    }
    promise = Promise.resolve();
  } else {
    promise = run();
  }

  const entry: AsyncDataEntry = { refs, promise };
  store().set(key, entry);
  return entry;
}

/**
 * `useAsyncData`. Awaitable: `const { data } = await useAsyncData(...)` resolves
 * after the first fetch, and `data` stays reactive. Page `<script setup>` becomes
 * async — the router-view is wrapped in `<Suspense>`.
 */
export async function useAsyncData<T>(
  a: string | (() => Promise<T> | T),
  b?: (() => Promise<T> | T) | AsyncDataOptions<T>,
  c?: AsyncDataOptions<T>,
): Promise<AsyncData<T>> {
  const { key, fn, opts } = parseArgs(a, b, c);
  const entry = getOrCreateEntry(key, fn, opts);
  await entry.promise;
  return entry.refs;
}

/**
 * `useLazyAsyncData`. Non-blocking: returns the refs immediately and resolves
 * `data` in the background (on the client — skipped on the server for
 * `{ server: false }`).
 */
export function useLazyAsyncData<T>(
  a: string | (() => Promise<T> | T),
  b?: (() => Promise<T> | T) | AsyncDataOptions<T>,
  c?: AsyncDataOptions<T>,
): AsyncData<T> {
  const { key, fn, opts } = parseArgs(a, b, c);
  return getOrCreateEntry(key, fn, opts).refs;
}

/** Re-run cached async-data fetchers (best-effort). */
export async function refreshAppData(keys?: string | string[]): Promise<void> {
  const wanted = keys === undefined ? undefined : new Set(Array.isArray(keys) ? keys : [keys]);
  const jobs: Promise<void>[] = [];
  for (const [key, entry] of store()) {
    if (wanted && !wanted.has(key)) continue;
    jobs.push(entry.refs.refresh());
  }
  await Promise.all(jobs);
}

/**
 * Seed the CLIENT store from the server hydration payload — called once by
 * `main.ts` before mount. Each seeded entry is already resolved (status
 * `success`, promise settled), so the matching awaited `useAsyncData` returns
 * instantly and does not refetch. `refresh` is (re)wired when `useAsyncData` runs.
 */
export function hydrateAsyncData(data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    if (clientStore.has(key)) continue;
    const refs: AsyncData<unknown> = {
      data: ref(value),
      pending: ref(false),
      error: ref(null),
      status: ref<AsyncDataStatus>("success"),
      refresh: async () => {},
    };
    clientStore.set(key, { refs, promise: Promise.resolve() });
  }
}
