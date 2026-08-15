import { describe, it, expect } from "vitest";
import { brandCss, BRAND_STYLE_ID } from "../../src/app/theme-brand.ts";
import { TOKENS, tokenContrast } from "../utils/css-tokens.ts";

/**
 * `brandCss` turns a docs project's `themeColor` into the one declaration that
 * themes the whole site's accent. Three things are worth holding onto:
 *
 *  - It emits a REFERENCE (`var(--brand-<hue>)`). That is only safe because the
 *    table lives in a plain `:root`/`.dark` pair rather than in `@theme` —
 *    Tailwind tree-shakes theme variables, and the previous implementation
 *    shipped broken for 17 of 22 palettes by referencing
 *    `var(--color-<name>-<shade>)`. The guard against that regression is below.
 *  - The name it emits has to actually EXIST in `tokens.css`, or the token
 *    resolves to nothing and the accent silently falls back.
 *  - It accepts more names than there are brand hues, so an existing
 *    `themeColor: violet` keeps rendering a purple site instead of dropping to
 *    the seed.
 *
 * The accent used to be three tokens that all had to move together here; it is
 * one now (see `tokens.css`), which is why there is nothing left to keep in
 * sync — `--brand` alone themes the links, the chips, the glow and the CTA.
 */

/** Pull the emitted values, by role, out of the CSS text. */
function parseAll(css: string): Record<string, string> {
  const body = /^:root:root\{(.+)\}$/.exec(css);
  if (!body) throw new Error(`could not parse brandCss output: ${css}`);
  const out: Record<string, string> = Object.create(null);
  for (const decl of body[1].split(";").filter(Boolean)) {
    const [name, value] = decl.split(/:(.*)/s);
    out[name] = value;
  }
  return out;
}

/** The `--brand` value alone — what most of these assertions are about. */
function parse(css: string): string {
  return parseAll(css)["--brand"];
}

const GEIST_HUES = ["blue", "red", "amber", "green", "teal", "purple", "pink"] as const;

describe("brandCss", () => {
  it.each(GEIST_HUES)("points %s at its derived accent", (hue) => {
    expect(parse(brandCss(hue)!)).toBe(`var(--brand-${hue})`);
  });

  /**
   * `--brand` and nothing else. An extra declaration here is how the accent gets
   * split back into roles by accident — a second token pointing at a different
   * hue themes the site in two colours at once, which reads as a bug in whatever
   * component happens to use the stale one rather than as a bug in this
   * function.
   */
  it.each(GEIST_HUES)("themes exactly one token (%s)", (hue) => {
    expect(Object.keys(parseAll(brandCss(hue)!))).toEqual(["--brand"]);
  });

  it.each(GEIST_HUES)("emits tokens that tokens.css actually defines (%s)", (hue) => {
    for (const value of Object.values(parseAll(brandCss(hue)!))) {
      const name = value.slice("var(".length, -1);
      expect(TOKENS.light[name], `${name} in :root`).toBeDefined();
      expect(TOKENS.dark[name], `${name} in .dark`).toBeDefined();
    }
  });

  /**
   * The whole point of the derived table: it clears AA against the page in BOTH
   * modes, so one declaration themes both. Asserted here as well as in
   * `tokens.test.ts` because THIS is the function that gets to choose the value —
   * pointing it at some other per-hue colour (Geist's solid-fill step is the
   * tempting one) would still pass every assertion in the token layer, and fail
   * this one on amber at 1.8:1.
   */
  it.each(GEIST_HUES)("stays legible on the page in both modes (%s)", (hue) => {
    const name = parse(brandCss(hue)!).slice("var(".length, -1);
    for (const mode of ["light", "dark"] as const) {
      expect(tokenContrast(mode, name, "--background"), `${hue} (${mode})`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  /** Tailwind palette names Geist has no scale for, kept working via aliases. */
  it.each([
    ["orange", "amber"],
    ["yellow", "amber"],
    ["lime", "green"],
    ["emerald", "green"],
    ["cyan", "teal"],
    ["sky", "blue"],
    ["indigo", "blue"],
    ["violet", "purple"],
    ["fuchsia", "pink"],
    ["rose", "red"],
  ])("maps %s onto Geist's %s", (name, hue) => {
    expect(parse(brandCss(name)!)).toBe(`var(--brand-${hue})`);
  });

  /**
   * A "gray" accent is a request for the monochrome look — which is the primary
   * text colour, and the look Geist ships by default.
   */
  it.each(["gray", "grey", "slate", "zinc", "neutral", "stone"])(
    "collapses %s onto the monochrome step",
    (name) => {
      expect(parse(brandCss(name)!)).toBe("var(--foreground)");
    },
  );

  /**
   * A bare CSS colour is used verbatim in both modes. The derived table cannot
   * help here — its per-mode values come from an OKLCH fit against a page colour
   * we would have to resolve first — so an author who hands us a raw colour has
   * opted out of the AA guarantee, and gets exactly what they asked for.
   */
  it("passes a bare CSS colour through unchanged", () => {
    for (const color of ["#ff8800", "rgb(1 2 3)", "oklch(0.7 0.1 200)"]) {
      expect(parse(brandCss(color)!)).toBe(color);
    }
  });

  it("is case-insensitive on names but preserves a colour's own casing", () => {
    expect(parse(brandCss("Purple")!)).toBe("var(--brand-purple)");
    expect(parse(brandCss("#AABBCC")!)).toBe("#AABBCC");
  });

  it("returns null for an unknown name or empty input", () => {
    for (const input of ["chartreuse-ish", "", "  ", undefined, null, 42]) {
      expect(brandCss(input)).toBeNull();
    }
  });

  /**
   * The regression that motivated moving off Tailwind's palettes: a
   * `var(--color-…)` reference resolves against whatever Tailwind happened to
   * emit, which depends on the class lists of unrelated components — so a
   * themeColor could render as `unset`.
   */
  it("never references a tree-shakeable Tailwind theme variable", () => {
    for (const name of [...GEIST_HUES, "violet", "gray"]) {
      expect(brandCss(name), `${name} must not reach for --color-*`).not.toMatch(/var\(--color-/);
    }
  });

  it("exports a stable style id", () => {
    expect(BRAND_STYLE_ID).toBe("undocs-runtime-brand");
  });

  /** Doubled selector, so it wins over `tokens.css` whenever Vite injects it. */
  it("out-specifies the token layer", () => {
    expect(brandCss("teal")).toMatch(/^:root:root\{/);
  });
});
