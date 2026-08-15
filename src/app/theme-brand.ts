/**
 * Runtime brand-color CSS shared by SSR and CSR.
 *
 * Geist itself is monochrome — solid buttons are `--primary`, and the only
 * colour in a stock Geist UI is the blue focus ring. undocs still lets each docs
 * project pick an accent (`docs.themeColor`, surfaced as
 * `useAppConfig().ui.colors.primary`), so this module resolves that name to one
 * of the seven derived brand hues and points `--brand` at it. `--primary` is
 * never touched: buttons stay monochrome, links and active nav pick up the accent.
 *
 * The emitted value is a `var(--brand-<hue>)` REFERENCE rather than a literal,
 * which is safe here and was not safe for the Tailwind palettes this replaced:
 * the brand table is declared in a plain `:root` / `.dark` pair in `tokens.css`,
 * not in `@theme`, so Tailwind never tree-shakes it. It also keeps this module
 * out of the light/dark question entirely — the table declares both modes, so
 * ONE declaration themes both, and there is no copy of a colour here to drift
 * from the stylesheet.
 *
 * Emitting CSS text lets both entries apply it identically: the server inlines it
 * into `<head>` during SSR (so the first paint is themed — no flash), and the
 * client applies it on the CSR/dev path. `BRAND_STYLE_ID` lets the client skip
 * re-injecting when the server already emitted the tag.
 */

/** The seven derived brand hues, addressable by name from the docs config. */
const BRAND_HUES = new Set(["blue", "red", "amber", "green", "teal", "purple", "pink"]);

/**
 * Names there is no brand hue for, mapped to the nearest one. These are the
 * Tailwind palette names the old implementation accepted, kept working so an
 * existing `themeColor: violet` keeps rendering a purple site instead of
 * silently falling back to the seed.
 */
const HUE_ALIASES: Record<string, string> = {
  orange: "amber",
  yellow: "amber",
  lime: "green",
  emerald: "green",
  cyan: "teal",
  sky: "blue",
  indigo: "blue",
  violet: "purple",
  fuchsia: "pink",
  rose: "red",
};

/** Neutral names: a monochrome site, where the accent IS the primary text. */
const NEUTRALS = new Set(["gray", "grey", "slate", "zinc", "neutral", "stone"]);

export const BRAND_STYLE_ID = "undocs-runtime-brand";

export function brandCss(themeColor: unknown): string | null {
  if (typeof themeColor !== "string" || !themeColor) return null;
  const color = themeColor.trim().toLowerCase();

  let brand: string;
  const hue = HUE_ALIASES[color] ?? color;
  if (BRAND_HUES.has(hue)) {
    brand = `var(--brand-${hue})`;
  } else if (NEUTRALS.has(hue)) {
    // A monochrome site: the accent collapses onto the primary-text step, which
    // is what `--primary` already uses. Geist's own look.
    brand = "var(--foreground)";
  } else if (/^(#|rgb|hsl|oklch|oklab|lab|lch|color\()/i.test(color)) {
    // A bare CSS colour is used verbatim in both modes — we cannot derive a
    // per-mode pair from it, and inverting it would surprise more than it helps.
    // An author who hands us a raw colour has opted out of the AA guarantee the
    // derived table carries; we use exactly what they asked for.
    brand = themeColor.trim();
  } else {
    return null;
  }

  // The doubled selector beats `tokens.css` even when Vite injects it later.
  return `:root:root{--brand:${brand};}`;
}
