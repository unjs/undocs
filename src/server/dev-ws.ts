import { defineWebSocketHandler } from "nitro/h3";
import { peers } from "./dev-reload";

// Dev-only WebSocket handler mounted at `/api/docs/_ws` (registered in
// `nitro.config.ts` only when NODE_ENV !== "production"). It just tracks the set
// of connected browser peers; `dev-watch.ts` broadcasts "reload" to them.
export default defineWebSocketHandler({
  open(peer) {
    peers.add(peer);
  },
  close(peer) {
    peers.delete(peer);
  },
  error(peer) {
    peers.delete(peer);
  },
});
