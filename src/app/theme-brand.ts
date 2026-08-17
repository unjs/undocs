/**
 * Runtime brand-color CSS shared by SSR and CSR.
 *
 * Geist itself is monochrome — solid buttons are `--primary`, and the only
 * colour in a stock Geist UI is the blue focus ring. undocs is monochrome by
 * DEFAULT for the same reason (`themeColor: mono`, which is what `tokens.css`
 * seeds), but it still lets each docs project pick an accent
 * (`docs.themeColor`, surfaced as `useAppConfig().ui.colors.primary`), so this
 * module resolves that name to one of the seven derived brand hues and points
 * `--brand` at it. `--primary` is never touched: buttons stay monochrome, links
 * and active nav pick up the accent.
 *
 * Two declarations, always: the accent and the pole its hover mixes toward. A
 * hue moves AWAY from the page on hover, mono is already there and recedes
 * toward it, and the seeded default is mono's — so a hue that emitted only
 * `--brand` would inherit mono's direction and hover the wrong way. See the
 * `--brand-hover` comment in `tokens.css` for why the two disagree. That pairing
 * lives in ONE place here (`brandDecls`), because there are now three producers
 * of it (the config, the visitor's own pick, and the inline `<head>` program
 * that pre-applies the pick) and a second copy is a hover that goes the wrong
 * way on exactly one of the three.
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
 *
 * ## Three producers, three specificities
 *
 * `--brand` can be set from three places, and they have a strict pecking order
 * that is encoded as SELECTOR SPECIFICITY, not as document order (the three tags
 * are written at different times — one by unhead during SSR, two by inline
 * `<head>` programs — so document order is not something any one of them can
 * rely on):
 *
 * | Producer                            | Selector                | Score   |
 * | ----------------------------------- | ----------------------- | ------- |
 * | `tokens.css`'s seed                 | `:root`                 | (0,1,0) |
 * | the docs project's `themeColor`     | `:root:root`            | (0,2,0) |
 * | the visitor's pick (`userBrandCss`) | `:root:root:root`       | (0,3,0) |
 * | an embedder's `br` key              | `:root:root:root`       | (0,3,0) |
 *
 * The last two TIE, and are separated by document order instead: the inline
 * programs run in source order and `inline/theme-color.ts` is emitted before
 * `inline/embed-theme.ts`, so an embedder still wins. `useThemeColor` also hides
 * the picker outright in that case, so the visitor is never offered a control
 * that the cascade would then ignore.
 */

/**
 * The accents a visitor can pick from, in the order the picker fans them out:
 * `mono` first, then the hue wheel from blue round to teal, so the arc reads as
 * a sweep rather than a list.
 *
 * This is also the set the `undocs-theme-color` storage value is validated
 * against, on BOTH sides — `inline/theme-color.ts` (pre-paint) and
 * `composables/useThemeColor.ts` (the app-side driver) — so a stale or
 * hand-edited entry can never reach `brandDecls`.
 */
export const THEME_COLORS = [
  "mono",
  "blue",
  "purple",
  "pink",
  "red",
  "amber",
  "green",
  "teal",
] as const;

export type ThemeColor = (typeof THEME_COLORS)[number];

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

/**
 * `mono` — the DEFAULT — and the neutral palette names that mean the same
 * thing: no accent, the primary text step. `tokens.css` seeds exactly this, so
 * naming it explicitly is a no-op; it is spelled out anyway because a config
 * that says `themeColor: mono` should keep meaning that if the seed ever moves.
 */
const MONO = new Set(["mono", "monochrome", "gray", "grey", "slate", "zinc", "neutral", "stone"]);

/**
 * The pole `--brand-hover` mixes toward. A hue moves away from the page (and so
 * away from the CTA's label, which IS the page); mono sits at that end already,
 * so it recedes toward the page instead, exactly as `--primary-hover` does.
 */
const HOVER_TOWARD_PAGE = "var(--background)";
const HOVER_TOWARD_TEXT = "var(--foreground)";

export const BRAND_STYLE_ID = "undocs-runtime-brand";

/** `id` of the `<style>` holding the VISITOR's own pick — see the table above. */
export const USER_BRAND_STYLE_ID = "undocs-user-brand";

/** `localStorage` key holding the visitor's `ThemeColor` (absent = the project's). */
export const THEME_COLOR_STORAGE_KEY = "undocs-theme-color";

/** The token a pickable accent points at — the one place the mapping is made. */
export function themeColorToken(hue: ThemeColor): string {
  return hue === "mono" ? "var(--foreground)" : `var(--brand-${hue})`;
}

/** The accent and the pole its hover mixes toward. Never one without the other. */
function brandDecls(hue: ThemeColor): string {
  const toward = hue === "mono" ? HOVER_TOWARD_PAGE : HOVER_TOWARD_TEXT;
  return `--brand:${themeColorToken(hue)};--brand-hover-toward:${toward};`;
}

/**
 * Resolve any accepted spelling of an accent — a Geist hue, a Tailwind palette
 * name, or one of the neutral synonyms for monochrome — to a `ThemeColor`.
 * `null` for anything else, INCLUDING a bare CSS colour: only `brandCss` accepts
 * those, because only the docs config can supply one.
 */
export function resolveThemeColor(input: unknown): ThemeColor | null {
  if (typeof input !== "string") return null;
  const name = input.trim().toLowerCase();
  if (!name) return null;
  const hue = HUE_ALIASES[name] ?? name;
  // `isThemeColor` first, so it also answers for the literal `mono`. Reusing it
  // rather than keeping a second set of the seven hues is not only about
  // duplication: `inline/theme-color.ts` imports from this module and pays for
  // every byte it keeps on every HTML response, and a module-level `new Set(…)`
  // built from a `.filter()` call is a statement the bundler will not drop even
  // though nothing in that program reads it.
  if (isThemeColor(hue)) return hue;
  if (MONO.has(hue)) return "mono";
  return null;
}

/** Is this exactly one of the values the picker stores? */
export function isThemeColor(value: unknown): value is ThemeColor {
  return typeof value === "string" && (THEME_COLORS as readonly string[]).includes(value);
}

/** The docs project's own `themeColor`, at (0,2,0). */
export function brandCss(themeColor: unknown): string | null {
  if (typeof themeColor !== "string" || !themeColor) return null;

  const hue = resolveThemeColor(themeColor);
  if (hue) return `:root:root{${brandDecls(hue)}}`;

  if (/^(#|rgb|hsl|oklch|oklab|lab|lch|color\()/i.test(themeColor.trim())) {
    // A bare CSS colour is used verbatim in both modes — we cannot derive a
    // per-mode pair from it, and inverting it would surprise more than it helps.
    // An author who hands us a raw colour has opted out of the AA guarantee the
    // derived table carries; we use exactly what they asked for.
    return `:root:root{--brand:${themeColor.trim()};--brand-hover-toward:${HOVER_TOWARD_TEXT};}`;
  }

  return null;
}

/**
 * The visitor's own pick, at (0,3,0) — above the docs project's tag, and level
 * with an embedder's (which wins on document order; see the table above).
 *
 * Deliberately stricter than `brandCss`: the input is a `localStorage` value, so
 * it is trusted only when it is one of the eight the picker itself writes.
 * `null` for anything else, which is what makes "no pick" and "junk entry" the
 * same, correct thing — the project's own accent shows through.
 */
export function userBrandCss(value: unknown): string | null {
  return isThemeColor(value) ? `:root:root:root{${brandDecls(value)}}` : null;
}
