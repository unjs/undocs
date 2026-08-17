export const peers = new Set<any>();

export function broadcastReload() {
  for (const p of peers) {
    try {
      p.send("reload");
    } catch {
      // Dead peers are removed by WebSocket close/error handlers.
    }
  }
}
