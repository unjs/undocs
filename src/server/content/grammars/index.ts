// Tests: test/content/grammars/registry.test.ts
import { languages, aliases } from "rangi/languages";
import mdcGrammars from "./mdc";
import type { LocalGrammar } from "./types";

export type { LocalGrammar, ShjDefinition, ShjRule, ShjToken } from "./types";

/**
 * Every name rangi answers to — its languages AND its aliases, which it spreads
 * into the same record. The source of truth for `KNOWN_LANGS` in `highlight.ts`,
 * so a language rangi gains needs no change here to become highlightable.
 */
export const BUNDLED_LANGS: string[] = Object.keys(languages);

/**
 * rangi's alias registry, INVERTED: alias name → the canonical language it
 * stands for (`yml` → `yaml`, `python` → `py`, `jsonc` → `json`).
 *
 * rangi publishes the forward direction only. It gets away with that because
 * looking a grammar up by either name is a plain property read — but we also
 * put the language in a `code-hl-lang-*` class, and there one spelling per
 * language beats one per fence infostring.
 *
 * The inversion is by OBJECT IDENTITY, not by name: rangi documents that an
 * alias holds "the very grammar it stands for, not a copy of it", so the entry
 * `aliases.yml` IS `languages.yaml`. That makes this exact rather than
 * heuristic, and it needs no hand-maintained table to drift out of date.
 */
export const BUNDLED_ALIASES: Record<string, string> = (() => {
  const canonical = Object.keys(languages).filter((name) => !(name in aliases));
  const byAlias: Record<string, string> = Object.create(null);
  for (const [alias, definition] of Object.entries(aliases)) {
    const name = canonical.find((c) => (languages as Record<string, unknown>)[c] === definition);
    if (name) byAlias[alias] = name;
  }
  return Object.freeze(byAlias);
})();

/**
 * Every locally-defined grammar: the ones rangi does not ship.
 *
 * There used to be four more — `jsx`/`tsx`, `jsonc`/`json5` and a corrected
 * `yaml` fork. rangi 2.1 ships jsx and tsx as real grammars, aliases jsonc and
 * json5 onto a `json` grammar that now handles comments and unquoted keys, and
 * fixed the yaml block-scalar bug the fork existed for. All measured at parity
 * or better than ours, so they are gone rather than kept in sync.
 *
 * Adding a language means adding a file here — `highlight.ts` reads names and
 * aliases off this list, so it never needs editing.
 */
export const LOCAL_GRAMMARS: LocalGrammar[] = [...mdcGrammars];

export const LOCAL_LANG_NAMES: string[] = LOCAL_GRAMMARS.map((g) => g.name);

/** Fence infostring → grammar name, for every alias a local grammar declares. */
export const LOCAL_ALIASES: Record<string, string> = Object.fromEntries(
  LOCAL_GRAMMARS.flatMap((g) => (g.aliases ?? []).map((a) => [a, g.name])),
);

/**
 * The `languages` option we hand rangi on every call.
 *
 * No registration step and no process-wide mutation: rangi takes custom
 * grammars per call and they apply to sub-languages too, so this is just a
 * frozen record built once at module scope.
 *
 * An entry whose name matches a bundled language REPLACES it — declared via
 * `overridesBuiltin`, which `registry.test.ts` enforces.
 */
export const LOCAL_LANGUAGES: Record<string, any> = Object.freeze(
  Object.fromEntries(LOCAL_GRAMMARS.map((g) => [g.name, g.definition])),
);
