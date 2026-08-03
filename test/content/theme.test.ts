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
 */

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

describe("token palette", () => {
  it("matches rangi's bundled default/dark themes", () => {
    const css = palette();
    for (const [type, light] of Object.entries(defaultTheme.tokens)) {
      expect(css[type], `.shj-${type} is missing from main.css`).toBeDefined();
      expect(css[type][0], `.shj-${type} light branch`).toBe(light);
      expect(css[type][1], `.shj-${type} dark branch`).toBe(dark.tokens[type as "kwd"]);
    }
  });

  it("covers every token type rangi colours, and no more", () => {
    const themed = new Set([...Object.keys(defaultTheme.tokens), ...Object.keys(dark.tokens)]);
    expect(Object.keys(palette()).sort()).toEqual([...themed].sort());
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
