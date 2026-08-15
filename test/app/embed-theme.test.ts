import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  EMBED_STYLE_ID,
  EMBED_THEME_TOKENS,
  FORCED_MODE_GLOBAL,
} from "../../src/app/embed-theme.ts";

/**
 * Exercises the COMPILED artifact — the exact bytes `entry-server.ts` inlines
 * into `<head>` — not the `.ts` source, so a compilation that mangles behaviour
 * fails here rather than in a browser. (`inline-build.test.ts` separately proves
 * the artifact matches its source.)
 *
 * The test env is `node` with no DOM, so the program runs through `new Function`
 * with the globals it touches passed as parameters — bare `location`/`document`/…
 * in the body then resolve to those params — against the minimal fake below.
 * The fake models only what the program uses: a document with a `<style>` whose
 * `sheet` supports `insertRule` + `rule.style.setProperty`, a `classList` on
 * `documentElement`, and a `location`/`history` pair.
 */
const EMBED_THEME_SCRIPT = readFileSync(
  fileURLToPath(new URL("../../src/app/inline/embed-theme.js", import.meta.url)),
  "utf8",
);
function run(hash: string, opts: { initialClass?: string[] } = {}) {
  const rules: { selectorText: string; style: Record<string, string> }[] = [];

  const sheet = {
    get cssRules() {
      return rules;
    },
    insertRule(text: string, index: number) {
      const selectorText = text.slice(0, text.indexOf("{"));
      const props: Record<string, string> = {};
      rules.splice(index, 0, {
        selectorText,
        style: props as any,
      });
      // `rule.style.setProperty(name, value)` — the only CSSOM surface used.
      (rules[index] as any).style = {
        props,
        setProperty(name: string, value: string) {
          props[name] = value;
        },
      };
      return index;
    },
  };

  const classes = new Set(opts.initialClass ?? ["dark"]);
  const head: any[] = [];
  const document = {
    documentElement: {
      classList: {
        toggle(name: string, force: boolean) {
          if (force) classes.add(name);
          else classes.delete(name);
        },
      },
    },
    head: {
      append(el: any) {
        head.push(el);
      },
    },
    createElement() {
      return { id: "", sheet };
    },
  };

  const location = {
    hash,
    pathname: "/guide",
    search: "?a=1",
  };

  let replaced: string | undefined;
  const history = {
    replaceState(_s: unknown, _t: string, url: string) {
      replaced = url;
    },
  };

  const window: Record<string, unknown> = {};

  const fn = new Function("window", "document", "location", "history", "atob", EMBED_THEME_SCRIPT);
  fn(window, document, location, history, globalThis.atob);

  const styled = head[0] as { id: string } | undefined;
  return {
    replaced,
    styleId: styled?.id,
    light: (rules[0] as any)?.style?.props as Record<string, string> | undefined,
    dark: (rules[1] as any)?.style?.props as Record<string, string> | undefined,
    selectors: rules.map((r) => r.selectorText),
    classes: [...classes].sort(),
    forced: window[FORCED_MODE_GLOBAL],
  };
}

/** base64url-encode a payload, the way an embedder builds the fragment. */
function payload(value: unknown): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

describe("embed-theme script", () => {
  it("applies mapped tokens to the light rule", () => {
    const out = run(`#~${payload({ p: "#0ea5e9", bg: "#fff", r: "0.5rem" })}`);
    expect(out.styleId).toBe(EMBED_STYLE_ID);
    expect(out.light).toEqual({
      "--primary": "#0ea5e9",
      "--background": "#fff",
      "--radius": "0.5rem",
    });
    expect(out.dark).toEqual({});
  });

  it("routes `d` to the dark rule, which outranks the light one", () => {
    const out = run(`#~${payload({ p: "#0ea5e9", d: { p: "#38bdf8", bg: "#0b0b0c" } })}`);
    expect(out.light).toEqual({ "--primary": "#0ea5e9" });
    expect(out.dark).toEqual({ "--primary": "#38bdf8", "--background": "#0b0b0c" });
    // Order matters: equal specificity, so the dark rule must come second.
    expect(out.selectors).toEqual([":root:root:root", ".dark:root:root"]);
  });

  it("covers every documented token key", () => {
    const all = Object.fromEntries(Object.keys(EMBED_THEME_TOKENS).map((k) => [k, "red"]));
    const out = run(`#~${payload(all)}`);
    expect(Object.keys(out.light!).sort()).toEqual(Object.values(EMBED_THEME_TOKENS).sort());
  });

  it("ignores unmapped keys, non-strings, over-long and url() values", () => {
    const out = run(
      `#~${payload({
        p: "#0ea5e9",
        // not in the map — must not reach the stylesheet
        display: "none",
        "--evil": "x",
        bg: 42,
        fg: "a".repeat(65),
        mu: "url(https://evil.example/pixel)",
        bd: "IMAGE-SET('https://evil.example/x')",
      })}`,
    );
    expect(out.light).toEqual({ "--primary": "#0ea5e9" });
  });

  it("strips the payload from the URL, keeping a real anchor", () => {
    const out = run(`#installation~${payload({ p: "#0ea5e9" })}`);
    expect(out.replaced).toBe("/guide?a=1#installation");
  });

  it("strips the payload even when it is malformed (never left for querySelector)", () => {
    const out = run("#~not-base64!!");
    expect(out.replaced).toBe("/guide?a=1");
    expect(out.light).toBeUndefined();
  });

  it("leaves a plain anchor untouched", () => {
    const out = run("#installation");
    expect(out.replaced).toBeUndefined();
    expect(out.light).toBeUndefined();
  });

  it("pins the color mode and exposes it for useColorMode", () => {
    const light = run(`#~${payload({ m: "l" })}`);
    expect(light.classes).toEqual(["light"]);
    expect(light.forced).toBe("light");

    const dark = run(`#~${payload({ m: "d" })}`, { initialClass: ["light"] });
    expect(dark.classes).toEqual(["dark"]);
    expect(dark.forced).toBe("dark");
  });

  it("leaves the mode alone when `m` is absent or invalid", () => {
    expect(run(`#~${payload({ p: "red" })}`).forced).toBeUndefined();
    expect(run(`#~${payload({ m: "system" })}`).forced).toBeUndefined();
    expect(run(`#~${payload({ m: "system" })}`).classes).toEqual(["dark"]);
  });

  it("ignores an over-long payload without touching the document", () => {
    const out = run(`#~${"a".repeat(2049)}`);
    expect(out.replaced).toBe("/guide?a=1");
    expect(out.styleId).toBeUndefined();
  });

  it("ignores a payload that is not a JSON object", () => {
    expect(run(`#~${payload("nope")}`).styleId).toBeUndefined();
    expect(run(`#~${payload(null)}`).styleId).toBeUndefined();
  });
});
