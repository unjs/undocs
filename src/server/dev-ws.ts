import { defineWebSocketHandler } from "nitro/h3";
import { peers } from "./dev-reload.ts";

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
