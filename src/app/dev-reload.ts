/**
 * Dev-only content live-reload (client).
 *
 * Opens a WebSocket to the Nitro `/api/docs/_ws` endpoint. When the server
 * fs-watcher (`src/server/dev-watch.ts`) sees a `.md`/`.yml` change it clears the
 * content-index cache and broadcasts "reload"; on that message we re-run the
 * cached `useAsyncData` fetchers via `refreshAppData`, whose reactive `data`
 * refs drive the mounted page — so the change shows WITHOUT a browser reload.
 *
 * This module is imported ONLY behind an `import.meta.env.DEV` guard in
 * `main.ts`, so it is tree-shaken out of the production client bundle entirely.
 */
import { refreshAppData } from "@app/composables/useAsyncData";

const WS_ROUTE = "/api/docs/_ws";

export function connectDevReload(): void {
  let socket: WebSocket | undefined;
  let closed = false;

  const connect = () => {
    if (closed) return;
    try {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${proto}//${window.location.host}${WS_ROUTE}`;
      socket = new WebSocket(url);
      socket.addEventListener("open", () => {
        console.info("[undocs] content live-reload connected");
      });
      socket.addEventListener("message", () => {
        void refreshAppData();
      });
      socket.addEventListener("close", () => {
        socket = undefined;
        if (!closed) setTimeout(connect, 1000);
      });
      socket.addEventListener("error", () => {
        try {
          socket?.close();
        } catch {
          // ignore
        }
      });
    } catch {
      if (!closed) setTimeout(connect, 1000);
    }
  };

  connect();
}
