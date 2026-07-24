/**
 * `useState` — a ref keyed by name (init runs once per key). Supports
 * `useState(key, init?)` and `useState(init)` (auto key).
 *
 * SSR-aware, mirroring `useAsyncData`: on the SERVER each request owns its store
 * (`server-context.ts`), so concurrent renders don't share state; the values are
 * serialized into the hydration payload. On the CLIENT a single module store is
 * used and `hydrateState()` seeds it before mount — so an initializer whose value
 * differs between runs (e.g. the landing background's `Math.random()` points)
 * reuses the server's value and hydrates without a mismatch.
 */
import { ref, type Ref } from "vue";

const clientStore = new Map<string, Ref<any>>();
let clientAutoKeyId = 0;

/** The active store: per-request on the server, module-level on the client. */
function store(): Map<string, Ref<any>> {
  if (import.meta.server) {
    const ctx = (globalThis as any).__undocsServerCtx?.();
    if (ctx) return ctx.state as Map<string, Ref<any>>;
  }
  return clientStore;
}

/** Next auto key. Per-request on the server (aligned with the client's fresh
 *  counter), module-level on the client. See `server-context.ts`. */
function nextAutoKey(): string {
  if (import.meta.server) {
    const ctx = (globalThis as any).__undocsServerCtx?.();
    if (ctx) return `$state:${ctx.stateAutoId++}`;
  }
  return `$state:${clientAutoKeyId++}`;
}

export function useState<T>(keyOrInit: string | (() => T), maybeInit?: () => T): Ref<T> {
  let key: string;
  let init: (() => T) | undefined;
  if (typeof keyOrInit === "function") {
    key = nextAutoKey();
    init = keyOrInit;
  } else {
    key = keyOrInit;
    init = maybeInit;
  }
  const s = store();
  if (!s.has(key)) {
    s.set(key, ref(init ? init() : undefined));
  }
  return s.get(key) as Ref<T>;
}

/** Seed the CLIENT store from the server hydration payload (called by `main.ts`). */
export function hydrateState(state: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(state)) {
    if (!clientStore.has(key)) clientStore.set(key, ref(value));
  }
}
