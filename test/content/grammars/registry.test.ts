import { describe, it, expect } from "vitest";
import {
  BUNDLED_LANGS,
  LOCAL_ALIASES,
  LOCAL_GRAMMARS,
  LOCAL_LANGUAGES,
  LOCAL_LANG_NAMES,
} from "../../../src/server/content/grammars";
import { html } from "./helper";

// Taken from rangi itself rather than hardcoded, so a version that adds or
// renames a language can't silently invalidate these invariants.
const BUNDLED = new Set(BUNDLED_LANGS);

describe("local grammar registry", () => {
  it("only shadows a bundled language when declared", () => {
    const undeclared = LOCAL_GRAMMARS.filter((g) => BUNDLED.has(g.name) && !g.overridesBuiltin).map(
      (g) => g.name,
    );
    expect(undeclared).toEqual([]);
  });

  it("gives every declared override a reason", () => {
    for (const g of LOCAL_GRAMMARS.filter((x) => x.overridesBuiltin)) {
      expect(BUNDLED.has(g.name), `${g.name} overrides nothing`).toBe(true);
      expect(g.overridesBuiltin!.length).toBeGreaterThan(20);
    }
  });

  it("has unique names and non-conflicting aliases", () => {
    expect(new Set(LOCAL_LANG_NAMES).size).toBe(LOCAL_LANG_NAMES.length);
    for (const alias of Object.keys(LOCAL_ALIASES)) {
      expect(BUNDLED.has(alias), `alias "${alias}" collides with a bundled language`).toBe(false);
      expect(LOCAL_LANG_NAMES).not.toContain(alias);
    }
  });

  it("gives every grammar a non-empty definition of tuple rules", () => {
    for (const g of LOCAL_GRAMMARS) {
      expect(g.definition.length, `${g.name} has no rules`).toBeGreaterThan(0);
      for (const rule of g.definition) {
        expect(Array.isArray(rule), `${g.name} has a non-tuple rule`).toBe(true);
        expect(rule[0], `${g.name} has a rule with no matcher`).toBeDefined();
      }
    }
  });

  it("exposes every grammar to rangi via the languages option", () => {
    expect(Object.keys(LOCAL_LANGUAGES).sort()).toEqual([...LOCAL_LANG_NAMES].sort());
  });

  it("routes every local name through highlightCode to its own wrapper class", () => {
    for (const name of LOCAL_LANG_NAMES) {
      expect(html("x", name)).toContain(`code-hl-lang-${name}`);
    }
  });

  it("routes every declared alias to its grammar", () => {
    for (const [alias, name] of Object.entries(LOCAL_ALIASES)) {
      expect(html("x", alias)).toContain(`code-hl-lang-${name}`);
    }
  });
});
