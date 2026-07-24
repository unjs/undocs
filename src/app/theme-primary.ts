/**
 * Runtime primary-color CSS.
 *
 * The primary color is not static: `useAppConfig().ui.colors.primary` resolves to
 * `docs.themeColor || "amber"`. Tailwind v4 emits every default palette as
 * `--color-<name>-<shade>` variables in `:root`, so we re-point the shadcn
 * `--primary` token (aliased by `--ui-primary`) at the requested palette — a 600
 * shade in light, 500 in dark, matching shadcn's own light/dark split.
 *
 * Emitting this as CSS text lets BOTH entries apply it identically: the server
 * inlines it into `<head>` during SSR (so the first paint is correctly themed —
 * no flash), and the client applies it for the CSR/dev path. `STYLE_ID` lets the
 * client skip re-injecting when the server already emitted the tag.
 *
 * Fallbacks: a bare CSS color (hex / oklch / rgb / …) is used verbatim for both
 * modes; an unknown name returns `null` (keeps the violet seed from tokens.css).
 */
const TAILWIND_PALETTES = new Set([
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
]);

/** The id used for the injected `<style>` tag (dedupe between server + client). */
export const STYLE_ID = "undocs-runtime-primary";

/** Foreground tokens: a near-white and a near-black, picked per-palette for AA. */
const LIGHT_FG = "oklch(0.985 0 0)";
const DARK_FG = "oklch(0.21 0 0)";

/**
 * Palettes whose LIGHT-mode shade (`-600`) is light enough that white text fails
 * WCAG AA (4.5:1) — they get a dark foreground instead. Derived by computing the
 * contrast of both foregrounds against Tailwind's oklch palette (see the
 * `--primary-foreground` note below); the set is the shades where dark wins.
 */
const DARK_FG_ON_600 = new Set([
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
]);

/**
 * Same, for the DARK-mode shade (`-500`). `-500` is lighter than `-600`, so more
 * palettes tip over into needing a dark foreground.
 */
const DARK_FG_ON_500 = new Set([
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "purple",
  "fuchsia",
  "pink",
  "rose",
]);

/** Build the primary-color CSS for a `themeColor`, or `null` to leave the seed. */
export function primaryCss(themeColor: unknown): string | null {
  if (typeof themeColor !== "string" || !themeColor) return null;
  const color = themeColor.trim();

  let light: string;
  let dark: string;
  let lightFg: string;
  let darkFg: string;
  if (TAILWIND_PALETTES.has(color)) {
    light = `var(--color-${color}-600)`;
    dark = `var(--color-${color}-500)`;
    // Pick the foreground that meets WCAG AA against each shade. Hardcoding white
    // failed the solid primary button (e.g. `bg-primary text-primary-foreground`)
    // for light palettes like amber/lime, where white text is ~2–3:1. A handful of
    // shades (sky-600, indigo/violet-500, fuchsia/pink/rose) can't reach 4.5:1 with
    // EITHER foreground — for those we still emit the higher-contrast one, which
    // clears the 3:1 large-text bar and is the best the raw palette allows.
    lightFg = DARK_FG_ON_600.has(color) ? DARK_FG : LIGHT_FG;
    darkFg = DARK_FG_ON_500.has(color) ? DARK_FG : LIGHT_FG;
  } else if (/^(#|rgb|hsl|oklch|oklab|color\()/i.test(color)) {
    light = color;
    dark = color;
    // A bare CSS color can't be introspected here; keep the near-white default.
    lightFg = LIGHT_FG;
    darkFg = LIGHT_FG;
  } else {
    return null;
  }

  // Selectors are doubled (`:root:root`, `.dark:root`) to raise specificity
  // above the plain `:root`/`.dark` seed in `tokens.css`. This override must win
  // regardless of stylesheet ORDER: in dev, Vite injects `tokens.css` as a
  // `<style>` AFTER this tag, so an equal-specificity `:root` rule there would
  // otherwise beat us (last-wins) and the runtime themeColor would be ignored.
  return (
    `:root:root{--primary:${light};--primary-foreground:${lightFg};}` +
    `.dark:root{--primary:${dark};--primary-foreground:${darkFg};}`
  );
}
