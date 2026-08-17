// Rangi rules are ordered tuples `[match, type?, sub?]`: earliest match wins,
// with array order breaking ties. Put specific/local rules before general bases.

// Order matches rangi's numeric token constants.
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

// Regexes need `g`; `sub` retokenizes by language name or nested rules and may
// combine with a token type for the outer match.

export type ShjRule = [
  match: RegExp,
  type?: ShjToken | undefined,
  sub?: string | ShjRule[] | undefined,
];

export type ShjDefinition = ShjRule[];

export interface LocalGrammar {
  name: string;
  aliases?: string[];
  definition: ShjDefinition;
  /** Required rationale when deliberately replacing a bundled grammar. */
  overridesBuiltin?: string;
}
