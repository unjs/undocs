/**
 * A tiny CSS custom-property reader for the token layer.
 *
 * Most roles in `tokens.css` are literals, but not all of them: `--brand` and
 * `--brand-foreground` are `var()` references into per-mode tables, which is
 * exactly what lets one declaration theme both modes — and exactly where a
 * mistake hides (a role pointing at something declared in only one mode, or one
 * that stops moving when the mode flips).
 *
 * So: parse the `:root` and `.dark` blocks into two flat maps, resolve `var()`
 * against them, and convert the result to linear sRGB for contrast maths. Only
 * the syntax `tokens.css` actually uses is supported — `hsl(H S% L%)`,
 * `#rgb`/`#rrggbb`/`#rrggbbaa`, and `oklch(L C H)` (the brand table, and the
 * syntax palette in `main.css`) — and anything else throws rather than guessing.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type TokenMap = Readonly<Record<string, string>>;

const TOKENS_CSS = readFileSync(
  fileURLToPath(new URL("../../src/app/assets/tokens.css", import.meta.url)),
  "utf8",
);

/** Every `--name: value;` declaration in the top-level rule for `selector`. */
function readBlock(selector: string): Record<string, string> {
  // The blocks are top-level and terminated by a `\n}`; nested `@theme` braces
  // never appear inside them.
  const block = new RegExp(String.raw`^${selector}\s*\{([\s\S]*?)\n\}`, "m").exec(TOKENS_CSS)?.[1];
  if (!block) throw new Error(`no ${selector} block in tokens.css`);
  const out: Record<string, string> = Object.create(null);
  for (const [, name, value] of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out[name] = value.trim().replaceAll(/\s+/g, " ");
  }
  return out;
}

const LIGHT = readBlock(String.raw`:root`);
const DARK_OVERRIDES = readBlock(String.raw`\.dark`);

/**
 * `.dark` only redeclares what CHANGES, exactly as the stylesheet does, so the
 * dark map has to inherit the rest from `:root` — same as the cascade.
 */
export const TOKENS: Readonly<Record<"light" | "dark", TokenMap>> = Object.freeze({
  light: Object.freeze({ ...LIGHT }),
  dark: Object.freeze({ ...LIGHT, ...DARK_OVERRIDES }),
});

/**
 * Only what the `.dark` block itself declares. Distinct from `TOKENS.dark`,
 * which is post-cascade: a token can be PRESENT in dark and hold the same value
 * as light (several Geist steps are deliberately mode-invariant), so "did dark
 * redeclare this?" cannot be answered by comparing values.
 */
export const DARK_BLOCK: TokenMap = Object.freeze({ ...DARK_OVERRIDES });

/** Resolve a token (or a raw value) to a concrete colour, following `var()`. */
export function resolve(mode: "light" | "dark", nameOrValue: string, depth = 0): string {
  if (depth > 10) throw new Error(`cyclic var() chain at ${nameOrValue}`);
  const map = TOKENS[mode];
  const value = nameOrValue.startsWith("--") ? map[nameOrValue] : nameOrValue;
  if (value === undefined) throw new Error(`${nameOrValue} is not defined in ${mode} mode`);
  const ref = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value.trim());
  return ref ? resolve(mode, ref[1], depth + 1) : value.trim();
}

/** Linear-light sRGB plus alpha. Alpha is 1 for every format but `#rrggbbaa`. */
export function toLinearRgb(color: string): [number, number, number, number] {
  const c = color.trim();

  const hsl = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/.exec(c);
  if (hsl) {
    const [h, s, l] = [Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100];
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [...([f(0), f(8), f(4)].map(srgbToLinear) as [number, number, number]), 1];
  }

  const oklch = /^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(c);
  if (oklch) {
    const L = c.includes("%") ? Number(oklch[1]) / 100 : Number(oklch[1]);
    const [C, H] = [Number(oklch[2]), Number(oklch[3])];
    const rad = (H * Math.PI) / 180;
    const [a, b] = [C * Math.cos(rad), C * Math.sin(rad)];
    const l = (L + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
    const m = (L - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
    const s = (L - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;
    return [
      4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
      -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
      -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
      1,
    ];
  }

  if (c.startsWith("#")) {
    const hex = c.slice(1);
    const full = hex.length === 3 || hex.length === 4 ? [...hex].map((x) => x + x).join("") : hex;
    if (full.length !== 6 && full.length !== 8) throw new Error(`unsupported colour: ${color}`);
    const byte = (i: number) => Number.parseInt(full.slice(i, i + 2), 16) / 255;
    return [
      srgbToLinear(byte(0)),
      srgbToLinear(byte(2)),
      srgbToLinear(byte(4)),
      full.length === 8 ? byte(6) : 1,
    ];
  }

  throw new Error(`unsupported colour: ${color}`);
}

function srgbToLinear(v: number): number {
  return v <= 0.040_45 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function luminance(color: string): number {
  const [r, g, b] = toLinearRgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio. Both colours must be opaque. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Contrast between two TOKENS in one mode — the form these tests want. */
export function tokenContrast(mode: "light" | "dark", fg: string, bg: string): number {
  return contrast(resolve(mode, fg), resolve(mode, bg));
}

/**
 * OKLCh chroma — "how saturated is this", independent of how light it is.
 *
 * The brand table is derived by trading lightness for chroma at a fixed contrast,
 * so chroma is the axis its assertions are actually about. Reading it off the
 * resolved colour rather than off the `oklch()` source text is deliberate: the
 * light table is authored as `oklch()` but a `themeColor` override or a future
 * retune need not be, and the property under test holds either way.
 */
export function chroma(color: string): number {
  const [R, G, B] = toLinearRgb(color);
  const l = Math.cbrt(0.412_221_470_8 * R + 0.536_332_536_3 * G + 0.051_445_992_9 * B);
  const m = Math.cbrt(0.211_903_498_2 * R + 0.680_699_545_1 * G + 0.107_396_956_6 * B);
  const s = Math.cbrt(0.088_302_461_9 * R + 0.281_718_837_6 * G + 0.629_978_700_5 * B);
  const a = 1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s;
  const b = 0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s;
  return Math.hypot(a, b);
}

/**
 * `fg` at `alpha` over `bg`, as an opaque `#rrggbb`.
 *
 * Tailwind's `bg-brand/10` renders a colour that appears nowhere in the
 * stylesheet, so the only way to assert anything about text sitting ON one is to
 * composite it here. Mixing happens in GAMMA-encoded sRGB because that is what a
 * browser does for `rgb(… / .1)` — averaging the linear values instead would
 * quietly report a different (and slightly darker) colour than ships.
 */
export function composite(fg: string, bg: string, alpha: number): string {
  const [f, b] = [toLinearRgb(fg), toLinearRgb(bg)].map(
    (c) => c.slice(0, 3).map(linearToSrgb) as [number, number, number],
  );
  const byte = (i: number) =>
    Math.round(Math.min(1, Math.max(0, f[i] * alpha + b[i] * (1 - alpha))) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${byte(0)}${byte(1)}${byte(2)}`;
}

function linearToSrgb(v: number): number {
  return v <= 0.003_130_8 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}
