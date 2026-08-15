import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  DARK_BLOCK,
  TOKENS,
  resolve,
  luminance,
  tokenContrast,
  contrast,
  composite,
} from "../utils/css-tokens.ts";

/**
 * The token layer (`src/app/assets/tokens.css`).
 *
 * The file used to transcribe eight of Geist's 10-step hue scales by hand in
 * both modes, and most of what was asserted here was "did the transcription
 * survive". Those scales are gone — what is left is roles, declared as
 * literals — so the failures worth catching changed shape:
 *
 *  1. A role declared in `:root` but not in `.dark`. It would inherit the LIGHT
 *     value through the cascade and blow out the page, and because nothing else
 *     reads these there is no build error.
 *  2. A role aimed at the wrong lightness. `--muted-foreground` on `--muted` is
 *     a pairing nobody looks at in both modes; an off-by-one still renders,
 *     just illegibly.
 *  3. The derived `--brand` table drifting off its contract — which is not a
 *     transcription at all, so there is no upstream to compare it against.
 *
 * So the assertions are about STRUCTURE and CONTRAST rather than literals: a
 * pinned table would only restate the stylesheet, while these fail when the
 * stylesheet stops meaning what it says.
 */

const MODES = ["light", "dark"] as const;

/** Every role whose VALUE differs per mode, and so must appear in `.dark`. */
const MODE_DEPENDENT = [
  "--background",
  "--foreground",
  "--card",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--primary",
  "--primary-foreground",
  "--primary-hover",
  "--border",
  "--input",
  "--ring",
  "--overlay",
  "--hairline",
  "--edge",
  "--elevation-small",
  "--grid-guide",
  "--grid-cross",
];

const STATUS = ["info", "success", "warning", "danger", "important"] as const;
const BRAND_HUES = ["blue", "red", "amber", "green", "teal", "purple", "pink"] as const;

describe("structure", () => {
  /**
   * The cascade is the whole mechanism here: `.dark` redeclares what changes and
   * everything else falls through from `:root`. A role that fell OUT of the dark
   * block still resolves — to its light value — so the only way to catch it is
   * to look at what the dark block DECLARES, not at whether the value changed.
   */
  it("redeclares every mode-dependent role under .dark", () => {
    for (const name of [
      ...MODE_DEPENDENT,
      ...STATUS.flatMap((s) => [`--${s}`, `--${s}-tint`, `--${s}-border`]),
      ...BRAND_HUES.map((h) => `--brand-${h}`),
    ]) {
      expect(DARK_BLOCK[name], `${name} missing from the .dark block`).toBeDefined();
    }
  });

  /**
   * ...and the converse. `--brand`, `--brand-foreground` and `--brand-hover` are
   * `var()` REFERENCES into tokens that are themselves per-mode, so they theme
   * both modes from one declaration. Redeclaring one in `.dark` would not be an
   * error the browser reports — it would just freeze that role at whatever the
   * duplicate said, which is how a themed site ends up rendering in two accents.
   */
  it("keeps the derived brand roles as single declarations", () => {
    for (const name of ["--brand", "--brand-foreground", "--brand-hover"]) {
      expect(DARK_BLOCK[name], `${name} should not be redeclared in .dark`).toBeUndefined();
      expect(TOKENS.light[name], `${name} missing from :root`).toBeDefined();
    }
  });
});

describe("semantic roles", () => {
  /** Text/surface pairings the components actually render, in both modes. */
  const PAIRS: ReadonlyArray<readonly [string, string, string]> = [
    ["body text", "--foreground", "--background"],
    ["muted text on the page", "--muted-foreground", "--background"],
    ["muted text on a well", "--muted-foreground", "--muted"],
    ["muted text on a hover fill", "--muted-foreground", "--accent"],
    ["body text on a well", "--foreground", "--muted"],
    ["body text on a card", "--foreground", "--card"],
    ["body text on a hover fill", "--foreground", "--accent"],
    ["the solid primary button", "--primary-foreground", "--primary"],
    ["the solid primary button, hovered", "--primary-foreground", "--primary-hover"],
    ["the default accent", "--brand", "--background"],
    ["the default accent on a card", "--brand", "--card"],
  ];

  it.each(MODES)("clears WCAG AA in %s mode", (mode) => {
    for (const [what, fg, bg] of PAIRS) {
      expect(tokenContrast(mode, fg, bg), `${what} (${mode})`).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * The surface ladder. Each surface sits FURTHER from the page than the one
   * before it — card (raised) < muted (a recessed well) < accent (a hover fill)
   * — in both modes, even though light walks down from white while dark walks
   * up from near-black. Comparing DISTANCES rather than lightnesses is what
   * makes one assertion hold for both.
   */
  it.each(MODES)("keeps the surface ladder ordered in %s mode", (mode) => {
    const from = (token: string) =>
      Math.abs(luminance(resolve(mode, token)) - luminance(resolve(mode, "--background")));
    expect(from("--card"), `card (${mode})`).toBeGreaterThan(0);
    expect(from("--muted"), `muted vs card (${mode})`).toBeGreaterThan(from("--card"));
    expect(from("--accent"), `accent vs muted (${mode})`).toBeGreaterThan(from("--muted"));
  });

  /**
   * `--primary-hover` has to RECEDE from `--primary` — toward the page — so the
   * button darkens in light and dims in dark. Flipping it the other way is the
   * natural-looking edit (`hover:bg-foreground`) and it makes the hovered button
   * the same colour as the resting one.
   */
  it.each(MODES)("recedes the primary hover toward the page in %s mode", (mode) => {
    const dist = (token: string) =>
      Math.abs(luminance(resolve(mode, token)) - luminance(resolve(mode, "--background")));
    expect(dist("--primary-hover")).toBeLessThan(dist("--primary"));
    expect(tokenContrast(mode, "--primary-foreground", "--primary-hover")).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});

describe("status roles", () => {
  /**
   * Each status is a triple — text, the tint it sits on, the border around it —
   * and `Alert` / `ProseCallout` / `Banner` render all three with no `dark:`
   * variant anywhere. That only works if every pairing holds in BOTH modes, so
   * this is the property those components rely on rather than a restatement of
   * the values.
   */
  it.each(MODES)("reads as text on its own tint in %s mode", (mode) => {
    for (const role of STATUS) {
      expect(
        tokenContrast(mode, `--${role}`, `--${role}-tint`),
        `${role} on its tint (${mode})`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(MODES)("reads as text on the page in %s mode", (mode) => {
    for (const role of STATUS) {
      expect(
        tokenContrast(mode, `--${role}`, "--background"),
        `${role} on the page (${mode})`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * The tint has to sit BETWEEN the page and the border, or the callout reads as
   * a flat block: the tint barely lifts off the page, the border is the visible
   * edge. Getting these two the wrong way round still renders.
   */
  it.each(MODES)("ranks page < tint < border in %s mode", (mode) => {
    const from = (token: string) =>
      Math.abs(luminance(resolve(mode, token)) - luminance(resolve(mode, "--background")));
    for (const role of STATUS) {
      expect(from(`--${role}-tint`), `${role} tint (${mode})`).toBeGreaterThan(0);
      expect(from(`--${role}-border`), `${role} border (${mode})`).toBeGreaterThan(
        from(`--${role}-tint`),
      );
    }
  });
});

describe("the derived accent", () => {
  /**
   * `--brand` is the ONE per-project colour, and this is its contract.
   *
   * The rule that makes a single token possible is a rule about SURFACES: brand
   * text sits on the page, on a card, or on a wash of itself — never on
   * `--muted` or `--accent`. Given that, each hue is the most saturated colour
   * of its angle that clears AA on all four. There used to be three tokens here
   * (`--brand` / `--brand-deep` / `--brand-vivid`) precisely because no single
   * value cleared AA across a wider surface set — and the deep one still
   * measured 4.38-4.49 on `--accent`, i.e. under AA. Constraining the surfaces
   * fixed that instead of hiding it behind a third name.
   *
   * Every value therefore sits DELIBERATELY close to the 4.5 line by
   * construction: there is no slack, and a hand-tweak of one digit is exactly
   * the edit that lands under it. `themeColor` picks one of these at build time
   * and the weakest is the one nobody tests with, so walk all seven.
   */
  it.each(MODES)("clears AA on every surface it is allowed on, in %s mode", (mode) => {
    for (const hue of BRAND_HUES) {
      const brand = resolve(mode, `--brand-${hue}`);
      for (const surface of ["--background", "--card"] as const) {
        const bg = resolve(mode, surface);
        expect(contrast(brand, bg), `${hue} on ${surface} (${mode})`).toBeGreaterThanOrEqual(4.5);
        // ...and on a wash of itself over that surface, which is what every
        // brand chip, tag, soft button and search mark actually renders.
        for (const alpha of [0.1, 0.15]) {
          expect(
            contrast(brand, composite(brand, bg, alpha)),
            `${hue} on its own /${alpha * 100} over ${surface} (${mode})`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  /**
   * The accent used as a FILL — the hero's lead CTA (`color: "brand"` in
   * `Button.ts`). The label is `--brand-foreground`, which IS the page colour,
   * so this ratio and "the accent on the page" are the same number. Nothing else
   * works: plain white fails every hue in dark (2.1-3.0) and near-black fails
   * every hue in light (2.3-3.4), so an "obviously the label should be white"
   * edit passes review and ships an unreadable dark mode.
   */
  it.each(MODES)("carries a legible label as a solid fill in %s mode", (mode) => {
    expect(resolve(mode, "--brand-foreground")).toBe(resolve(mode, "--background"));
    for (const hue of BRAND_HUES) {
      expect(
        contrast(resolve(mode, "--brand-foreground"), resolve(mode, `--brand-${hue}`)),
        `${hue} fill (${mode})`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * ...and the hover only ever helps, because it mixes toward `--foreground` —
   * darker in light, brighter in dark, i.e. AWAY from the page, and so away from
   * the label, which IS the page. The reflex reach for `bg-brand/90` recedes
   * TOWARD it and lands at ~3.7 in light. Asserted structurally: `color-mix`
   * cannot be resolved here, but its direction can.
   */
  it("moves the brand hover away from the page, not toward it", () => {
    expect(resolve("light", "--brand-hover")).toMatch(
      /^color-mix\(in oklab, var\(--brand\) \d+%, var\(--foreground\)\)$/,
    );
  });

  /**
   * The surface rule, enforced on the SOURCE rather than on the stylesheet.
   *
   * `--brand` is derived against the page, a card and a wash of itself, and
   * nothing else — so `bg-accent text-brand` or `bg-muted text-brand` renders
   * the accent on a surface it was never measured against, at roughly 3.9:1.
   * That is not hypothetical: it is exactly what the old `--brand-deep` token
   * existed to paper over, in exactly those two pairings, and it is the edit
   * someone makes when an active nav item "should look like the other hover
   * states". An active item wants `bg-brand/10 text-brand`.
   */
  it("never puts brand text on a neutral fill", () => {
    const root = fileURLToPath(new URL("../../src/app", import.meta.url));
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          walk(path);
          continue;
        }
        if (!/\.(vue|ts)$/.test(entry)) continue;
        for (const [line] of readFileSync(path, "utf8").matchAll(/^.*\btext-brand\b.*$/gm)) {
          if (/\bbg-(accent|muted)\b/.test(line)) offenders.push(`${path}: ${line.trim()}`);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});

describe("grid guides", () => {
  /**
   * The Geist grid's rule lines — the guides inside a `Grid` and the crosses at
   * their intersections. They are read by scoped component styles directly,
   * never through a Tailwind utility, so nothing else in the build would notice
   * if one stopped resolving.
   *
   * The assertions are relational rather than pinned, because the numbers came
   * off vercel.com/geist and the RELATIONSHIPS carry the look: a solid colour
   * (not the alpha `--border`), a per-mode choice, and a cross that reads one
   * rung stronger than the rule it sits on.
   */
  it.each(MODES)("draws with a solid colour, not the alpha border, in %s mode", (mode) => {
    // `--border` is alpha, so an 8%-black hairline picks up whatever sits behind
    // it — and the guides cross the landing backdrop. Geist's own guides are
    // solid steps for that reason.
    expect(resolve(mode, "--grid-guide")).toMatch(/^hsl\(/);
    expect(resolve(mode, "--grid-cross")).toMatch(/^hsl\(/);
    expect(resolve(mode, "--grid-guide")).not.toBe(resolve(mode, "--border"));
  });

  /**
   * Both step AWAY from the page, and the cross steps further. The comparison
   * has to be a distance: light walks down from white while dark walks up from
   * near-black, so a raw `<`/`>` on luminance would hold in one mode and invert
   * in the other.
   */
  it.each(MODES)("ranks background < guide < cross in %s mode", (mode) => {
    const from = (token: string) =>
      Math.abs(luminance(resolve(mode, token)) - luminance(resolve(mode, "--background")));
    expect(from("--grid-guide"), `guide (${mode})`).toBeGreaterThan(0);
    expect(from("--grid-cross"), `cross vs guide (${mode})`).toBeGreaterThan(from("--grid-guide"));
  });

  /**
   * Guides are solid by default. Dashing is opt-in per grid, via `GridSystem`'s
   * `dashedGuides` prop, which overrides this token — so the default is what
   * every un-opted grid draws.
   */
  it("defaults to solid rules", () => {
    expect(TOKENS.light["--grid-guide-style"]).toBe("solid");
  });

  it("defines the non-colour grid metrics", () => {
    expect(TOKENS.light["--grid-guide-width"]).toBe("1px");
    expect(TOKENS.light["--grid-cross-size"]).toMatch(/^\d+px$/);
    expect(TOKENS.light["--grid-cell-padding"]).toMatch(/^[\d.]+rem$/);
  });
});

describe("metrics", () => {
  /**
   * Geist's control ladder. `Button.ts` writes these as `h-(--size-small)` and
   * reuses the same token for the square (icon-only) width, so a control cannot
   * come out non-square by drift. `tiny` is ours — the Button exposes the size
   * and upstream ships no token for it.
   */
  it("defines the control heights, ascending", () => {
    const px = (name: string) => Number.parseInt(TOKENS.light[name], 10);
    expect(px("--size-tiny")).toBeLessThan(px("--size-small"));
    expect(px("--size-small")).toBeLessThan(px("--size-medium"));
    expect(px("--size-medium")).toBeLessThan(px("--size-large"));
  });
});
