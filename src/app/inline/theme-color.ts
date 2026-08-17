/**
 * INLINE PROGRAM — apply the visitor's picked accent before the first paint.
 * See `inline/README.md`.
 *
 * The SSR shell inlines the DOCS PROJECT's accent (`brandCss`, from
 * `themeColor`), because that is the only one the server knows: a visitor's own
 * pick lives in `localStorage`, which is not in the request. The app-side driver
 * (`composables/useThemeColor.ts`) applies it, but it rides in the module bundle
 * — deferred — while the stylesheet painting the links, the active nav item and
 * the landing glow blocks the first paint. So the browser can paint the
 * project's accent and only then flip to the visitor's, which they see as a
 * colour flash on every cold load.
 *
 * Running here removes it. The tag this writes is the SAME element the driver
 * later updates in place (`USER_BRAND_STYLE_ID`), so the cascade position
 * established here survives every subsequent pick.
 *
 * This appends to `<head>` and touches nothing inside Vue's hydration root, so
 * it cannot cause a mismatch.
 *
 * Runs BEFORE `inline/embed-theme.ts` — deliberately. Both write `--brand` at
 * (0,3,0), so the later tag wins, which is how an embedder's pinned accent
 * stays authoritative over the visitor's own. See the specificity table in
 * `theme-brand.ts`.
 */
import { THEME_COLOR_STORAGE_KEY, USER_BRAND_STYLE_ID, userBrandCss } from "../theme-brand.ts";

let stored: string | null = null;
try {
  stored = localStorage.getItem(THEME_COLOR_STORAGE_KEY);
} catch {
  // Storage blocked (private mode / blocked cookies) — the project's accent stands.
}

// `userBrandCss` returns null for "nothing picked" AND for a junk entry, which
// are the same thing here: emit no tag and let the project's accent through.
const css = userBrandCss(stored);
if (css) {
  const style = document.createElement("style");
  style.id = USER_BRAND_STYLE_ID;
  style.textContent = css;
  document.head.append(style);
}
