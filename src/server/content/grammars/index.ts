import { languages, aliases } from "rangi/languages";
import mdcGrammars from "./mdc.ts";
import type { LocalGrammar } from "./types.ts";

export type { LocalGrammar, ShjDefinition, ShjRule, ShjToken } from "./types.ts";

// Includes aliases because rangi spreads them into its language record.

export const BUNDLED_LANGS: string[] = Object.keys(languages);

// Invert aliases by documented grammar object identity to emit one canonical
// `code-hl-lang-*` class per language without a drifting manual table.

export const BUNDLED_ALIASES: Record<string, string> = (() => {
  const canonical = Object.keys(languages).filter((name) => !(name in aliases));
  const byAlias: Record<string, string> = Object.create(null);
  for (const [alias, definition] of Object.entries(aliases)) {
    const name = canonical.find((c) => (languages as Record<string, unknown>)[c] === definition);
    if (name) byAlias[alias] = name;
  }
  return Object.freeze(byAlias);
})();

// Prefer bundled grammars measured at parity or better; declare local additions here.

export const LOCAL_GRAMMARS: LocalGrammar[] = [...mdcGrammars];

export const LOCAL_LANG_NAMES: string[] = LOCAL_GRAMMARS.map((g) => g.name);

export const LOCAL_ALIASES: Record<string, string> = Object.fromEntries(
  LOCAL_GRAMMARS.flatMap((g) => (g.aliases ?? []).map((a) => [a, g.name])),
);

// Per-call local grammars avoid global mutation. Bundled-name replacements must
// declare `overridesBuiltin` because this record overrides them.

export const LOCAL_LANGUAGES: Record<string, any> = Object.freeze(
  Object.fromEntries(LOCAL_GRAMMARS.map((g) => [g.name, g.definition])),
);
