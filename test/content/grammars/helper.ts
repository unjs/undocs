import { tokenize } from "rangi";
import { highlightCode } from "../../../src/server/content/highlight.ts";
import { LOCAL_LANGUAGES } from "../../../src/server/content/grammars/index.ts";

/**
 * Helpers for grammar tests.
 *
 * Token inspection goes through rangi's own `tokenize()`, which returns
 * `{ text, type }` directly — no parsing highlighted HTML out of the markup.
 *
 * `html()` still goes through the real `highlightCode`, so wrapper-class and
 * alias-routing assertions keep testing the actual production path.
 */

/** One token: its type and the text it covered. */
export interface Token {
  type: string;
  text: string;
}

/**
 * Every TYPED token, in source order. Untyped runs of plain text are dropped.
 *
 * Takes a name rangi itself resolves, or a LOCAL grammar's canonical name.
 * rangi knows its own aliases, so `tokens(src, "yml")` works — but
 * `LOCAL_LANGUAGES` is keyed by name only, so a local grammar's alias
 * (`tokens(src, "comark")`) comes back empty. That resolution lives in
 * `highlightCode`, so assert on local aliases through `html()` instead.
 */
export function tokens(code: string, lang: string): Token[] {
  return tokenize(code, { lang, languages: LOCAL_LANGUAGES })
    .filter((t) => t.type !== undefined)
    .map((t) => ({ type: t.type as string, text: t.text }));
}

/**
 * The token type covering `needle`, or `undefined` if it isn't tokenized.
 * The main assertion helper: `expect(typeOf(src, "mdc", "::card")).toBe("kwd")`.
 */
export function typeOf(code: string, lang: string, needle: string): string | undefined {
  return tokens(code, lang).find((t) => t.text.includes(needle))?.type;
}

/**
 * Share of non-whitespace characters that ended up inside a typed token.
 *
 * A blunt regression metric — useful as a floor (`expect(pct).toBeGreaterThan(70)`)
 * so a rule change can't silently gut a grammar. Do NOT chase 100%: plain
 * identifiers and prose are legitimately untokenized, and markdown-ish grammars
 * sit low by design.
 */
export function coverage(code: string, lang: string): number {
  const all = tokenize(code, { lang, languages: LOCAL_LANGUAGES });
  const size = (s: string) => s.replace(/\s/g, "").length;
  const total = all.reduce((n, t) => n + size(t.text), 0);
  const typed = all.filter((t) => t.type).reduce((n, t) => n + size(t.text), 0);
  return total === 0 ? 0 : Math.round((typed / total) * 100);
}

/** Raw highlighted HTML from the production path, for wrapper assertions. */
export function html(code: string, lang: string): string {
  return highlightCode(code, lang);
}
