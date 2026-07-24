/**
 * useOffline — a reactive "is the app offline?" signal.
 *
 * Two independent inputs feed it, whichever fires first wins:
 *   1. The browser's own reachability — `navigator.onLine` seeded once, then the
 *      `online` / `offline` window events.
 *   2. Messages from our service worker (`public/sw.js`). The SW posts
 *      `undocs:offline` the moment it has to serve a request from cache (a real
 *      network failure) and `undocs:online` when the network recovers. This is
 *      the indicator the SW injects for the client bundle: it means "what you're
 *      looking at came from the offline cache".
 *
 * Client-only by construction: the store is a module-level ref and every browser
 * API is guarded, so importing this during SSR is inert (`offline` stays `false`,
 * matching the server's first render — no hydration mismatch). Mirrors the lazy
 * `init()` shape of `useColorMode`.
 */
import { ref, type Ref } from "vue";

const offline = ref(false);
let _initialized = false;

/**
 * Reconnecting reloads the page: while offline the user has been reading cached
 * (possibly stale) content, so a fresh render is the least-surprising thing —
 * and it re-runs the normal `/api/docs/*` fetches against the live network. Only
 * reload on an actual offline -> online transition, never on the initial seed.
 */
function goOnline(): void {
  if (offline.value) window.location.reload();
  offline.value = false;
}

function init(): void {
  if (_initialized || typeof window === "undefined") return;
  _initialized = true;

  // 1. Seed + track from the browser's coarse reachability signal.
  offline.value = navigator.onLine === false;
  window.addEventListener("online", goOnline);
  window.addEventListener("offline", () => (offline.value = true));

  // 2. Refine with the service worker's cache-fallback signals (see sw.js).
  navigator.serviceWorker?.addEventListener("message", (event) => {
    const type = (event.data as { type?: string } | undefined)?.type;
    if (type === "undocs:offline") offline.value = true;
    else if (type === "undocs:online") goOnline();
  });
}

export function useOffline(): Ref<boolean> {
  init();
  return offline;
}
