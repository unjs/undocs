import { languages } from "rangi/languages";
import type { LocalGrammar, ShjDefinition, ShjRule } from "./types.ts";

// Bundled grammars use numeric token references, hence the local narrowing cast.

const md = languages.md as ShjDefinition;

/**
 * Based on comarkdown's TextMate grammar. Nested blocks use `:{2,}`; `.class`
 * and `#id` are valueless attributes; slots are whole `#name` lines. Rangi has
 * no begin/end state, so delimiters are line-anchored and YAML scope uses lookbehind.
 */

const NAME = String.raw`\w[\w-]*`;

/**
 * Prop bag branches match one character at a time to avoid catastrophic
 * backtracking on an unfinished `{`; excluding newlines prevents cross-line capture.
 */
const ATTRS = String.raw`\{(?:[^{}'"\n]|'[^'\n]*'|"[^"\n]*")*\}`;

const ATTR_RULES: ShjRule[] = [
  [/^\{|\}$/g, "oper"],
  // Match assignment as a unit while retokenizing `=` as an operator.
  [/=\s*("[^"\n]*"?|'[^'\n]*'?|[^\s{}'"]+)/g, "str", [[/^=/g, "oper"]]],
  // Comark treats `.class` and `#id` as valueless attribute names.
  [/[^\s{}=]+/g, "class"],
];

const attrs: ShjRule = [RegExp(ATTRS, "g"), undefined, ATTR_RULES];

/**
 * Require YAML's opening `---` directly after a component or at document start;
 * otherwise unrelated thematic breaks can retokenize intervening prose as YAML.
 */
const PROPS: ShjRule = [
  RegExp(
    String.raw`(?:(?<![^])|(?<=^[ \t]*:{2,}[^\n]*\n))[ \t]*---[ \t]*\n[^]*?\n[ \t]*---[ \t]*$`,
    "gm",
  ),
  undefined,
  [
    [/---/g, "oper"],
    [/(?<=---[ \t]*\n)[^]*(?=\n[ \t]*---)/g, undefined, "yaml"],
  ],
];

const BLOCK_OPEN: ShjRule = [
  RegExp(String.raw`^[ \t]*:{2,}${NAME}(?:[ \t]*${ATTRS})?[ \t]*$`, "gm"),
  "kwd",
  [[/^[ \t]*:{2,}/g, "oper"], attrs],
];

const BLOCK_CLOSE: ShjRule = [/^[ \t]*:{2,}[ \t]*$/gm, "oper"];

// Whole-line anchoring distinguishes `#slot` from ATX headings independently of rule order.

const SLOT: ShjRule = [
  RegExp(String.raw`^[ \t]*#${NAME}[ \t]*$`, "gm"),
  "class",
  [[/^[ \t]*#/g, "oper"]],
];

// Override flat Markdown heading tokens to preserve operator hashes and trailing props.

const HEADING: ShjRule = [
  /^[ \t]{0,3}#{1,6}[ \t]+[^\n]*/gm,
  "section",
  [[/^[ \t]*#{1,6}/g, "oper"], attrs],
];

const BRACKET_RULES: ShjRule[] = [[/^\[|\]$/g, "oper"]];

const bracketed: ShjRule = [/\[[^\]]*\]/g, "str", BRACKET_RULES];

// Whitespace/start lookbehind excludes prose colons and the second colon of block openers.

const INLINE: ShjRule = [
  RegExp(String.raw`(?<=^|\s):${NAME}(?:\[[^\]\n]*\])?(?:${ATTRS})?(?:\[[^\]\n]*\])?`, "gm"),
  "kwd",
  [[/^:/g, "oper"], attrs, bracketed],
];

const SPAN: ShjRule = [
  RegExp(String.raw`\[[^\]\n]*\]${ATTRS}`, "g"),
  undefined,
  [[/^\[[^\]]*\]/g, "str", BRACKET_RULES], attrs],
];

const BINDING: ShjRule = [
  /\{\{[^{}\n]*\}\}/g,
  undefined,
  [
    [/^\{\{|\}\}$/g, "oper"],
    [/\|\|/g, "oper"],
    [/(?<=\|\|)[^}]*/g, "str"],
    [/[^\s|]+/g, "var"],
  ],
];

// Attached props require an adjacent non-space and run last to avoid stealing owned bags.

const ATTRS_ATTACHED: ShjRule = [RegExp(String.raw`(?<=\S)${ATTRS}`, "g"), undefined, ATTR_RULES];

// MDC rules precede Markdown so they win equal-index matches for prop blocks and spans.

const mdcRules: ShjDefinition = [
  PROPS,
  BLOCK_OPEN,
  BLOCK_CLOSE,
  SLOT,
  HEADING,
  INLINE,
  SPAN,
  BINDING,
  ATTRS_ATTACHED,
];

export const mdc: LocalGrammar = {
  name: "mdc",
  aliases: ["comark"],
  definition: [...mdcRules, ...md],
};

export default [mdc];
