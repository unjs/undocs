/**
 * undocs service worker (served at `/sw.js`) — TOMBSTONE.
 *
 * The offline service worker is temporarily disabled: it proved unreliable in
 * the field. `main.ts` no longer registers it and unregisters whatever it finds,
 * but that only reaches a client that runs the CURRENT bundle — a client the old
 * SW is still serving from its own cache may never get there. So the script at
 * this URL, which the browser re-checks on navigation regardless, is now a
 * no-op that removes itself: it takes over from the previous version, drops
 * every `undocs-offline*` cache, releases its clients and unregisters.
 *
 * There is deliberately NO `fetch` listener, so from the moment this activates
 * nothing is intercepted — controlled tabs go straight back to the network
 * without waiting for a reload.
 *
 * To re-enable the offline SW, restore this file and the registration in
 * `main.ts` (`git log -- src/app/public/sw.js`).
 */
self.addEventListener("install", () => {
  // Replace the old (caching) version immediately rather than waiting for every
  // tab using it to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Claim first: the clients the previous version controls become ours (and
      // this version intercepts nothing), so they stop being served from cache
      // right away.
      await self.clients.claim().catch(() => {});
      const keys = await caches.keys().catch(() => []);
      await Promise.all(
        keys.filter((k) => k.startsWith("undocs-offline")).map((k) => caches.delete(k)),
      );
      await self.registration.unregister().catch(() => {});
    })(),
  );
});
