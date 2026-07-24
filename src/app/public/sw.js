/**
 * undocs offline service worker (served at `/sw.js`).
 *
 * Goal: keep the docs usable after they've been visited once, even with no
 * network — and let the client bundle KNOW when that is happening so it can
 * surface the offline banner.
 *
 * Strategy: network-first with a cache fallback. Every successful same-origin
 * GET for the app shell / bundle / content API is copied into the `undocs-offline`
 * cache as it flows through. When a later request fails (the user went offline),
 * we serve the cached copy instead. The moment we fall back to cache we
 * `postMessage("undocs:offline")` to every controlled client — that message is
 * the "indicator" the app listens for (see `composables/useOffline.ts`); when a
 * network request next succeeds we post `undocs:online`.
 *
 * Registered from `main.ts` in production only (a SW in dev fights Vite's HMR).
 */
const CACHE = "undocs-offline-v1";

// The bare app shell, precached so a first offline navigation to any route has
// something to boot from. Everything else is cached on demand below.
const PRECACHE = ["/"];

// Upper bound on on-demand cache entries, so the cache can't grow without limit
// across a long session or many deploys (each release ships fresh hashed
// `/_undocs/*` bundles). When exceeded we evict oldest-first: Cache keys are
// insertion-ordered and — because this SW is network-first, re-`put`ing every
// entry on each successful online fetch — insertion order approximates recency,
// making this an approximate LRU. The precached shell (`/`) is never evicted.
const MAX_ENTRIES = 200;

async function trimCache(cache) {
  const keys = await cache.keys();
  const overflow = keys.length - MAX_ENTRIES;
  if (overflow <= 0) return;
  const evictable = keys.filter((req) => new URL(req.url).pathname !== "/");
  for (let i = 0; i < overflow && i < evictable.length; i++) {
    await cache.delete(evictable[i]);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {}),
  );
  // Take over without waiting for existing tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Last known reachability. Tracked so we only message clients on a transition
// (offline <-> online), not on every single request.
let online = true;

function broadcast(type) {
  self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    for (const client of clients) client.postMessage({ type });
  });
}

/**
 * Should this request participate in the offline cache? Any same-origin GET —
 * navigations (the HTML shell), the hashed client bundle (`/_undocs/*`), the
 * content API (`/api/docs/*`), raw markdown (`/raw/*`), AND static public assets
 * like `/icon.svg` / `/unjs.svg` / fonts that a page needs to render.
 *
 * Excluded: the service worker itself (must always come from the network so
 * updates land), the dev websocket, and a handful of heavy endpoints that are
 * rarely wanted offline but would balloon the cache — OG images (`/_og/*`), the
 * LLM text dumps (`/llms.txt`, `/llms-full.txt`), and the `/_content` debug page.
 */
function isCacheable(request, url) {
  if (request.method !== "GET" || url.origin !== self.location.origin) return false;
  const { pathname } = url;
  if (pathname === "/sw.js") return false;
  if (pathname.startsWith("/api/docs/_ws")) return false;
  if (pathname.startsWith("/_og/")) return false;
  if (pathname === "/_content") return false;
  if (pathname === "/llms.txt" || pathname === "/llms-full.txt") return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (!isCacheable(request, url)) return; // default browser handling

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Stash a copy of successful responses for future offline use. Skip 206
        // (`response.ok` covers the whole 2xx range, but `cache.put` rejects on a
        // partial response) and keep the write alive past `respondWith` with
        // `waitUntil` so the SW isn't torn down mid-put. `.catch` swallows a
        // `QuotaExceededError` etc. — a failed cache write must not break the fetch.
        if (response.ok && response.status !== 206) {
          const copy = response.clone();
          event.waitUntil(
            caches
              .open(CACHE)
              .then((cache) => cache.put(request, copy).then(() => trimCache(cache)))
              .catch(() => {}),
          );
        }
        if (!online) {
          online = true;
          broadcast("undocs:online");
        }
        return response;
      })
      .catch(async () => {
        // Network failed — fall back to whatever we cached, and for a navigation
        // fall back to the app shell (`/`) so the SPA still boots. A route the
        // user actually visited hydrates from its cached HTML payload; a route
        // never visited offline boots the shell but can't fetch its content.
        const cached =
          (await caches.match(request)) ||
          (request.mode === "navigate" ? await caches.match("/") : undefined);
        if (cached) {
          if (online) {
            online = false;
            broadcast("undocs:offline");
          }
          return cached;
        }
        return new Response("Offline and no cached copy is available.", {
          status: 503,
          statusText: "Offline",
          headers: { "content-type": "text/plain" },
        });
      }),
  );
});
