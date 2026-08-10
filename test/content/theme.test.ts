import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dark, defaultTheme } from "rangi/themes";
import { highlightCode } from "../../src/server/content/highlight";

/**
 * `highlightCode` runs rangi in `classes: true` mode, which emits `shj-<type>`
 * spans and NO colours — the palette lives in `assets/main.css` instead.
 *
 * That split is what keeps the markup small, but it also means the two halves
 * can drift apart silently: rangi can recolour a theme, or add a token type,
 * and nothing breaks until someone notices a page rendering the wrong colour.
 * These tests are the seam between them.
 *
 * Both branches are Vesper, which rangi does NOT ship — so unlike the grammars
 * there is no upstream to diff against. The tables below ARE the theme, pinned
 * so an accidental edit to the stylesheet shows up as a failing diff rather than
 * a recoloured page, and every colour is held to WCAG AA against the surface it
 * is actually painted on.
 */

// Partial only because rangi types `esc` into the token record while neither
// bundled theme colours it; the coverage test below is what enforces the rest.
type Palette = Partial<Record<keyof typeof dark.tokens, string>>;

/**
 * Vesper (github.com/raunofreiberg/vesper), mapped from its TextMate scopes onto
 * rangi's token types. The scope each colour comes from is noted; where Vesper
 * has no direct counterpart the nearest scope is used, which is why so many
 * types share its `#ffc799` accent.
 */
const VESPER_DARK: Palette = {
  deleted: "#ff8080", // markup.deleted
  err: "#ff8080", // invalid
  var: "#fff", // variable — Vesper's plain foreground
  section: "#ffc799", // markup.heading
  kwd: "#a0a0a0", // keyword, storage.type
  class: "#ffc799", // entity.name, support.class
  cmnt: "#909090", // comment — `#8b8b8b94` upstream, opaque + lifted (see main.css)
  bracket: "#a0a0a0", // editorBracketHighlight.foreground1-6 (all six are this grey)
  insert: "#99ffe4", // markup.inserted
  type: "#ffc799", // support.type
  func: "#ffc799", // entity.name.function
  bool: "#ffc799", // constant.language.boolean
  num: "#ffc799", // constant.numeric
  oper: "#a0a0a0", // keyword.control
  str: "#99ffe4", // string
};

/**
 * The light variant, which Vesper does not publish. Derived per hue in OKLCH
 * from the table above: hue kept, lightness inverted, chroma raised so a pastel
 * tuned for a near-black editor still reads as a colour on a near-white one.
 * Same collapsing onto one accent, so the two modes stay recognisably one theme.
 */
const VESPER_LIGHT: Palette = {
  deleted: "#b8132d",
  err: "#b8132d",
  var: "#101010", // Vesper's own background, used as the foreground
  section: "#90510b",
  kwd: "#5a5a5a",
  class: "#90510b",
  cmnt: "#6b6b6b",
  bracket: "#5a5a5a",
  insert: "#0e6d5b",
  type: "#90510b",
  func: "#90510b",
  bool: "#90510b",
  num: "#90510b",
  oper: "#5a5a5a",
  str: "#0e6d5b",
};

const CSS = readFileSync(
  fileURLToPath(new URL("../../src/app/assets/main.css", import.meta.url)),
  "utf8",
);

/** `.shj-<type> { color: light-dark(<light>, <dark>) }` → `{ type: [light, dark] }` */
function palette(): Record<string, [string, string]> {
  const out: Record<string, [string, string]> = {};
  const rule = /\.shj-([a-z]+)\s*\{([^}]*)\}/g;
  for (const [, type, body] of CSS.matchAll(rule)) {
    const color = /color:\s*light-dark\(\s*([^,\s]+)\s*,\s*([^)\s]+)\s*\)/.exec(body);
    if (color) out[type] = [color[1], color[2]];
  }
  return out;
}

const TOKENS_CSS = readFileSync(
  fileURLToPath(new URL("../../src/app/assets/tokens.css", import.meta.url)),
  "utf8",
);

/**
 * `--muted` (= `--ui-bg-muted`) from each mode — the surface `ProsePre` paints
 * code blocks on, and so the background the contrast check has to measure
 * against. Read from `tokens.css` rather than hardcoded, so restyling the app's
 * neutrals fails here instead of quietly dimming every code block.
 */
const CODE_BG = (() => {
  const read = (selector: string) => {
    const block = new RegExp(String.raw`${selector}\s*\{([\s\S]*?)\n\}`).exec(TOKENS_CSS)?.[1];
    const value = block && /--muted:\s*([^;]+);/.exec(block)?.[1];
    if (!value) throw new Error(`--muted not found in ${selector} of tokens.css`);
    return value.trim();
  };
  return { light: read(":root"), dark: read(String.raw`\.dark`) };
})();

/**
 * WCAG contrast between two CSS colours. Hand-rolled because the two formats we
 * need span both files: the palette is hex, the neutrals it sits on are OKLCH.
 */
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function luminance(color: string): number {
  const [r, g, b] = toLinearRgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `#rgb` / `#rrggbb` / `oklch(L C H)` → linear-light sRGB. */
function toLinearRgb(color: string): [number, number, number] {
  const oklch = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(color);
  if (oklch) {
    const [L, C, H] = oklch.slice(1).map(Number) as [number, number, number];
    const h = (H * Math.PI) / 180;
    const [a, bb] = [C * Math.cos(h), C * Math.sin(h)];
    const l = (L + 0.396_337_777_4 * a + 0.215_803_757_3 * bb) ** 3;
    const m = (L - 0.105_561_345_8 * a - 0.063_854_172_8 * bb) ** 3;
    const s = (L - 0.089_484_177_5 * a - 1.291_485_548 * bb) ** 3;
    return [
      4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
      -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
      -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
    ];
  }
  const hex = color.replace("#", "");
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  if (full.length !== 6) throw new Error(`unsupported colour: ${color}`);
  return [0, 2, 4].map((i) => {
    const c = Number.parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
}

describe("token palette", () => {
  it.each([
    ["light", 0, VESPER_LIGHT],
    ["dark", 1, VESPER_DARK],
  ] as const)("matches Vesper in %s mode", (_mode, branch, theme) => {
    const css = palette();
    for (const [type, color] of Object.entries(theme)) {
      expect(css[type], `.shj-${type} is missing from main.css`).toBeDefined();
      expect(css[type][branch], `.shj-${type} ${_mode} branch`).toBe(color);
    }
  });

  it("covers every token type rangi colours, and no more", () => {
    const themed = [
      ...new Set([...Object.keys(defaultTheme.tokens), ...Object.keys(dark.tokens)]),
    ].sort();
    expect(Object.keys(palette()).sort()).toEqual(themed);
    // Both variants have to cover it: rangi can emit any of these classes.
    expect(Object.keys(VESPER_LIGHT).sort()).toEqual(themed);
    expect(Object.keys(VESPER_DARK).sort()).toEqual(themed);
  });

  it("clears WCAG AA against the surface code blocks are painted on", () => {
    // Vesper is tuned for its own near-black editor, and its light variant is
    // ours to invent — so readability is the constraint that actually binds
    // here, and it binds against `--ui-bg-muted` (the code-block background,
    // `ProsePre.vue`) rather than the page background.
    const css = palette();
    const failures: string[] = [];
    for (const [mode, branch, bg] of [
      ["light", 0, CODE_BG.light],
      ["dark", 1, CODE_BG.dark],
    ] as const) {
      for (const [type, colors] of Object.entries(css)) {
        const ratio = contrast(colors[branch], bg);
        if (ratio < 4.5) failures.push(`.shj-${type} ${mode}: ${ratio.toFixed(2)}:1 on ${bg}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps the italic that rangi's inline mode applied to comments", () => {
    // Not theme data — an output convention of the inline path, so in classes
    // mode it is ours to reproduce.
    expect(/\.shj-cmnt\s*\{[^}]*font-style:\s*italic/.test(CSS)).toBe(true);
  });

  it("styles every token class the highlighter can actually emit", () => {
    // `esc` is deliberately unstyled: neither theme colours it, so it inherits
    // exactly as it did inline. Every other emitted class must have a rule.
    const sources: Array<[string, string]> = [
      ["ts", "const a: number = 1 // c"],
      ["md", "# Title\n\n```js\nlet x = 1\n```"],
      ["mdc", "::card{title='x'}\n#slot\n::"],
      ["diff", "-old\n+new"],
      ["http", "GET /x"],
      ["yaml", "# c\nkey: 'v'\n"],
    ];
    const emitted = new Set<string>();
    for (const [lang, code] of sources) {
      for (const [, cls] of highlightCode(code, lang).matchAll(/class="shj-([a-z]+)"/g)) {
        emitted.add(cls);
      }
    }
    expect(emitted.size).toBeGreaterThan(5);
    const styled = new Set(Object.keys(palette()));
    expect([...emitted].filter((c) => c !== "esc" && !styled.has(c))).toEqual([]);
  });
});
