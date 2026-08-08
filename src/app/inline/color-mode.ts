/**
 * INLINE PROGRAM — apply the visitor's color mode before the first paint.
 * See `inline/README.md`.
 *
 * The SSR shell ships `<html class="dark">`, because the server cannot know a
 * given visitor's preference: it lives in `localStorage` (or in their OS
 * setting), neither of which is in the request. The app-side driver
 * (`composables/useColorMode.ts`) corrects the class, but it rides in the
 * module bundle — deferred — while the stylesheet that paints the background
 * blocks the first paint. So the browser can paint dark and only then flip,
 * which a light-preference visitor sees as a flash on every cold load.
 *
 * Running here — parsed and executed before the body paints — removes it. The
 * class is also what `main.css` maps to CSS `color-scheme`, so this fixes the
 * `light-dark()` resolution of syntax-highlighted tokens at the same time.
 *
 * This only touches `<html>`, OUTSIDE Vue's hydration root (`#root`), so it
 * cannot cause a hydration mismatch — see the note in `useColorMode.ts` about
 * why the toggle still renders the SSR default on its first client render.
 *
 * Runs BEFORE `inline/embed-theme.ts`, whose `m` key pins the mode for an
 * embedder and must therefore win over the visitor's own preference.
 */
import { COLOR_MODE_STORAGE_KEY, DEFAULT_COLOR_MODE } from "../color-mode";

let preference: string | null = null;
try {
  preference = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
} catch {
  // Storage blocked (private mode / blocked cookies) — fall back to the default.
}

const resolved =
  preference === "light" || preference === "dark"
    ? preference
    : preference === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : DEFAULT_COLOR_MODE;

const root = document.documentElement;
root.classList.toggle("dark", resolved === "dark");
root.classList.toggle("light", resolved === "light");
