/**
 * Types for LOCAL grammars — languages `rangi` doesn't ship, which we define
 * ourselves and pass in per call via the `languages` option.
 *
 * A grammar is an ordered array of rules. The tokenizer runs every rule's regex
 * from the current index and takes the EARLIEST match; ties go to the rule that
 * appears FIRST in the array. So specific rules go before general ones, and a
 * derived grammar puts its own rules ahead of the base it spreads:
 *
 *   const jsx = [...jsxSpecificRules, ...languages.js];
 *
 * ## Rules are TUPLES, not objects
 *
 * This is the one thing to keep in mind coming from `@speed-highlight/core`,
 * which used `{ match, type, sub }`. rangi uses positional tuples:
 *
 *   [match, type, sub]
 *
 *   { type: "kwd", match: /x/g }            ->  [/x/g, "kwd"]
 *   { match: /x/g, sub: "js" }              ->  [/x/g, undefined, "js"]
 *   { type: "str", match: /x/g, sub: [...] }->  [/x/g, "str", [...]]
 *
 * `expand` is gone; the shared number/string rules are inlined into the shipped
 * grammars, so anything spread from `base.ts` already has them.
 */

/** The 15 token types, in the order rangi's own numeric constants use. */
export type ShjToken =
  | "deleted"
  | "err"
  | "var"
  | "section"
  | "kwd"
  | "class"
  | "cmnt"
  | "insert"
  | "type"
  | "func"
  | "bool"
  | "num"
  | "oper"
  | "str"
  | "esc";

/**
 * One grammar rule: `[match, type?, sub?]`.
 *
 * - `match` — the regex to match (needs the `g` flag).
 * - `type` — the token to paint the match. Omit to leave it unpainted, or to
 *   let `sub` do the painting.
 * - `sub` — re-tokenize the matched text with another grammar. Takes a LANGUAGE
 *   NAME (`"js"`, `"css"`, `"todo"`, or one of ours — the `languages` record is
 *   shared and applies to sub-languages too) or a nested rule array. This is how
 *   `html` delegates `<script>` bodies to `js`, with nothing imported.
 *
 * `type` and `sub` combine: the whole match gets `type`, then `sub`
 * re-tokenizes inside it.
 */
export type ShjRule = [
  match: RegExp,
  type?: ShjToken | undefined,
  sub?: string | ShjRule[] | undefined,
];

export type ShjDefinition = ShjRule[];

/**
 * A grammar we define locally.
 *
 * `name` is what `highlightCode` passes to rangi and what lands in the
 * `code-hl-lang-<name>` class. `aliases` are the markdown fence infostrings
 * that route here — declared alongside the grammar so `highlight.ts` never
 * needs editing to add a language.
 */
export interface LocalGrammar {
  name: string;
  aliases?: string[];
  definition: ShjDefinition;
  /**
   * Set when this grammar deliberately REPLACES a language rangi ships, to fix
   * a defect in the bundled one. Entries in the `languages` option override
   * bundled grammars, which is a hazard by accident and a tool on purpose — so
   * it must be declared. `registry.test.ts` fails on undeclared shadowing.
   * Must explain WHY.
   */
  overridesBuiltin?: string;
}
