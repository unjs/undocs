// Dev-only shared singleton holding connected WebSocket peers.
export const peers = new Set<any>();

export function broadcastReload() {
  for (const p of peers) {
    try {
      p.send("reload");
    } catch {
      // ignore send failures on dead peers
    }
  }
}
