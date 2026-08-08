/**
 * Embedded-theme override — the shared contract.
 *
 * An embedder (typically an iframe) restyles the site per-embed by putting a
 * payload in the URL FRAGMENT:
 *
 *   https://docs.example.com/guide#~<base64url-json>
 *   https://docs.example.com/guide#installation~<base64url-json>
 *
 * The fragment is the only part of the URL the server never sees, which is
 * exactly what makes it the right channel: it never touches the cache key, the
 * SSR render, or prerendered HTML. The flip side is that SSR cannot pre-apply
 * it, so the payload is read by a BLOCKING inline `<head>` script — see
 * `inline/embed-theme.ts` for the program and `inline/README.md` for how it is
 * compiled and shipped.
 *
 * Payload — `base64url(JSON)`, short keys mapped by `EMBED_THEME_TOKENS`:
 *
 *   { p: "#0ea5e9", bg: "#fff", d: { p: "#38bdf8" }, m: "l" }
 *
 * `d` holds dark-mode overrides; `m` pins the color mode (`"l"` / `"d"`) and
 * reaches `useColorMode` through `FORCED_MODE_GLOBAL`.
 *
 * This module holds only what BOTH sides need — the inline program and the app
 * (`useColorMode`) — so the two can never disagree about the global's name.
 */

/** The settable tokens: payload key → CSS custom property. */
export const EMBED_THEME_TOKENS: Readonly<Record<string, string>> = Object.freeze({
  p: "--primary",
  pf: "--primary-foreground",
  bg: "--background",
  fg: "--foreground",
  mu: "--muted",
  muf: "--muted-foreground",
  bd: "--border",
  c: "--card",
  r: "--radius",
  w: "--ui-container",
  f: "--font-sans",
});

/** Where the inline script leaves a pinned mode for `useColorMode` to pick up. */
export const FORCED_MODE_GLOBAL = "__UNDOCS_FORCED_MODE__";

/** `id` of the injected `<style>` — one per document, easy to spot in devtools. */
export const EMBED_STYLE_ID = "undocs-embed-theme";

/** Separates an optional real anchor from the payload: `#anchor~<payload>`. */
export const EMBED_HASH_SEPARATOR = "~";

/** Longest accepted payload; anything larger is ignored unparsed. */
export const EMBED_MAX_PAYLOAD = 2048;

/** Longest accepted token VALUE. */
export const EMBED_MAX_VALUE = 64;
