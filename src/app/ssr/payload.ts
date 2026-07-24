/**
 * SSR payload — the state bridge from server render to client hydration.
 *
 * During SSR the content fetched by `useAsyncData` and any `useState` values are
 * collected into a per-request store (see `server-context.ts`). This module
 * serializes that store into an inline `<script>` on the server, and the client
 * (`main.ts`) reads it back to seed the same stores BEFORE hydration — so awaited
 * `useAsyncData` calls resolve instantly with the server's data (no refetch, no
 * hydration mismatch), and `useState` initializers (e.g. the landing background's
 * random points) reuse the server-generated value.
 *
 * Shared, browser-safe: no node-only imports here (the client imports the type
 * and `PAYLOAD_GLOBAL`; the server additionally imports `serializePayload`).
 */

/** The `window` property that carries the hydration payload. */
export const PAYLOAD_GLOBAL = "__UNDOCS__";

export interface UndocsPayload {
  /** Resolved `useAsyncData` results, keyed by data key. */
  data: Record<string, unknown>;
  /** `useState` values, keyed by state key. */
  state: Record<string, unknown>;
  /** Server-resolved Iconify icon data, keyed by `collection:name`. */
  icons: Record<string, unknown>;
  /**
   * Set when the server rendered the error page (a fatal `createError`, e.g. a
   * 404) instead of the app. The client seeds this into its root error boundary
   * so its FIRST render is the error page too — matching the server's DOM. Without
   * it the client would hydrate `app.vue`, re-run the failing page, throw, and
   * swap in the error page mid-hydration — a mismatch that crashes Vue's unmount.
   */
  error?: {
    statusCode?: number;
    statusMessage?: string;
    message?: string;
  };
}

/**
 * Serialize a payload to a JS literal for inlining in a non-module `<script>`.
 * `<` is escaped so a value containing `</script>` cannot close the tag early.
 */
export function serializePayload(payload: UndocsPayload): string {
  return JSON.stringify(payload).replace(/</g, "\\u003C");
}

/** Read the payload the server inlined onto `window`, or an empty payload. */
export function readPayload(): UndocsPayload {
  const raw = (globalThis as any)[PAYLOAD_GLOBAL] as UndocsPayload | undefined;
  return {
    data: raw?.data ?? {},
    state: raw?.state ?? {},
    icons: raw?.icons ?? {},
    error: raw?.error,
  };
}
