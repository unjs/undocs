/**
 * INLINE PROGRAM — embedded-theme override. See `inline/README.md`.
 *
 * Compiled by `scripts/build-inline.mjs` to the checked-in `embed-theme.js`,
 * which `entry-server.ts` inlines into `<head>` as a blocking `<script>`.
 *
 * Why blocking and inline: the theme payload lives in the URL fragment, which
 * the server never receives, so SSR cannot pre-apply it. Deferring to the app
 * bundle would paint the default theme first and then flip — a visible flash on
 * every embedded page load.
 *
 * Two safety properties, both deliberate:
 *   * values are written with `setProperty` on a CSSOM rule, never concatenated
 *     into CSS text, so a crafted value cannot escape the rule it sits in;
 *   * only the mapped `--*` tokens are settable, and values are length-capped
 *     and `url()`-free, so a link anyone can craft cannot turn this into a
 *     fetch/exfiltration primitive.
 *
 * Keep it dependency-free beyond `../embed-theme` (plain constants): every
 * import is inlined into the bundle, and this ships on every HTML response.
 */
import {
  EMBED_HASH_SEPARATOR,
  EMBED_MAX_PAYLOAD,
  EMBED_MAX_VALUE,
  EMBED_STYLE_ID,
  EMBED_THEME_TOKENS,
  FORCED_MODE_GLOBAL,
} from "../embed-theme.ts";

/** Values that could make a token fetch a URL if it landed in the wrong property. */
const FETCHING_VALUE = /url\(|image-set\(|element\(/i;

const hash = location.hash;
const sep = hash.indexOf(EMBED_HASH_SEPARATOR);

if (sep !== -1) {
  const raw = hash.slice(sep + 1);

  // Strip the payload FIRST, before parsing: `#~eyJ...` is not a valid CSS
  // selector, and the router's `querySelector(hash)` scroll throws on it. Any
  // real anchor in front of the separator is preserved; a payload-only fragment
  // leaves a bare `#`, dropped so the URL bar comes out clean.
  const rest = hash.slice(0, sep);
  history.replaceState(null, "", location.pathname + location.search + (rest === "#" ? "" : rest));

  applyTheme(raw);
}

function applyTheme(raw: string): void {
  if (!raw || raw.length > EMBED_MAX_PAYLOAD) return;

  let theme: Record<string, unknown>;
  try {
    theme = JSON.parse(atob(raw.replaceAll("-", "+").replaceAll("_", "/")));
  } catch {
    return;
  }
  if (!theme || typeof theme !== "object") return;

  const style = document.createElement("style");
  style.id = EMBED_STYLE_ID;
  document.head.append(style);
  const sheet = style.sheet;
  if (!sheet) return;

  // Both selectors score (0,3,0) — above tokens.css (`:root`) and above the
  // runtime themeColor tag (`:root:root` / `.dark:root`) — and the dark rule is
  // second, so it wins whenever `.dark` matches.
  sheet.insertRule(":root:root:root{}", 0);
  sheet.insertRule(".dark:root:root{}", 1);

  apply(sheet.cssRules[0] as CSSStyleRule, theme);
  apply(sheet.cssRules[1] as CSSStyleRule, theme.d);

  if (theme.m === "l" || theme.m === "d") {
    const dark = theme.m === "d";
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("light", !dark);
    (window as any)[FORCED_MODE_GLOBAL] = dark ? "dark" : "light";
  }
}

function apply(rule: CSSStyleRule, source: unknown): void {
  if (!source || typeof source !== "object") return;
  for (const [key, value] of Object.entries(source)) {
    const token = EMBED_THEME_TOKENS[key];
    if (!token || typeof value !== "string" || value.length > EMBED_MAX_VALUE) continue;
    if (FETCHING_VALUE.test(value)) continue;
    rule.style.setProperty(token, value);
  }
}
