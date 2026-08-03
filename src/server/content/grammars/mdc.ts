// Tests: test/content/grammars/mdc.test.ts
import { languages } from "rangi/languages";
import type { LocalGrammar, ShjDefinition, ShjRule } from "./types";

/**
 * rangi's bundled markdown, which this grammar extends. The cast narrows
 * rangi's `ShjTokenRef` (`number | string`) to our `ShjToken` union — the
 * bundled grammars refer to a token type by index to save bundle bytes.
 */
const md = languages.md as ShjDefinition;

/**
 * MDC — Markdown Components (the "comark" flavour undocs parses with `md4x`).
 *
 * This was the WORST fallback undocs shipped: routed to plain `md`, a
 * component-heavy sample measured 3% coverage, and the entire miss was the
 * component syntax itself — every `::card{...}` in `docs/1.guide/2.components.md`
 * rendered as flat grey text. That syntax is the thing undocs docs exist to
 * demonstrate, so this grammar matters more than its fence count suggests.
 *
 * The construct list below is taken from the official VSCode extension's
 * TextMate grammar (`comarkdown/vscode-comark`, `syntaxes/mdc.tmLanguage.json`)
 * rather than guessed. Three things it settled that guessing would have got
 * wrong:
 *
 *   1. **Block delimiters are `:{2,}`, not exactly `::`.** Nesting is expressed
 *      by ADDING colons — `::hero` wraps `:::card` wraps `::::card` — and the
 *      closing fence must repeat the opening count. Matching only `::` would
 *      leave every nested component plain.
 *   2. **`.class` / `#id` shorthands are not their own construct.** In the
 *      reference they fall out of the attribute-NAME character class
 *      (`[^=><\s]*`), so `{.red}` and `{#nuxt-logo}` are ordinary valueless
 *      attributes. One rule, not three.
 *   3. **A slot is a line that contains nothing but `#name`.** The reference's
 *      slot pattern is `^(\s*)(#[\w\-\_]*)\s*$` — anchored at BOTH ends. That,
 *      and nothing about position inside a block, is what separates `#title`
 *      from the `#### Install the package` heading that sits inside `::steps`.
 *
 * ## Nesting, and what a flat tokenizer can't do
 *
 * rangi has no begin/end state: a grammar is one ordered rule array and every
 * rule matches independently. So component nesting cannot be modelled
 * STRUCTURALLY — there is no way to know that a `::` closes `::tab` rather than
 * `::tabs`, and no way to scope a rule to "inside a component". Every construct
 * here is therefore matched as a LINE-ANCHORED delimiter instead: the opening
 * `:{2,}name{...}` line, the bare `:{2,}` closing line, and the `#slot` line.
 * The visible result is identical for well-formed input — only cross-checking
 * (an unbalanced `::`, a slot outside a component) is lost.
 *
 * The one place that state genuinely mattered is the YAML prop block, which is
 * only meaningful directly under a component. `PROPS` recovers that with a
 * lookbehind rather than a parser state; see its comment.
 */

/** A component, slot or attribute name: `card`, `pm-install`, `code-tree`. */
const NAME = String.raw`\w[\w-]*`;

/**
 * A `{...}` prop bag: `{label="npm" icon="i-lucide-package"}`, `{.red}`,
 * `{#nuxt-logo}`, `{defaultValue="src/app.ts" expandAll}`.
 *
 * Quoted values may contain `{`/`}`, so they get their own alternatives. Those
 * are written as SINGLE-character alternatives rather than `[^{}'"]+`: a
 * `(?:X+)*` shape backtracks catastrophically on a bag that never closes (an
 * unterminated `{` at the end of a fence is a completely ordinary thing for a
 * docs author to be mid-typing), while disjoint single-char branches can only
 * match one way per position.
 *
 * Newlines are excluded so an unclosed `{` cannot reach across the document and
 * swallow a real bag further down. Comark attributes are single-line in practice.
 */
const ATTRS = String.raw`\{(?:[^{}'"\n]|'[^'\n]*'|"[^"\n]*")*\}`;

/** How the innards of a prop bag are coloured. */
const ATTR_RULES: ShjRule[] = [
  [/^\{|\}$/g, "oper"],
  // `="value"` / `='value'` / `=bare`. Matched as a unit so the `=` can stay an
  // operator while the value reads as a string, exactly as html/vue do.
  [/=\s*("[^"\n]*"?|'[^'\n]*'?|[^\s{}'"]+)/g, "str", [[/^=/g, "oper"]]],
  // Whatever is left is an attribute name — including `.class` and `#id`, which
  // comark treats as plain names (see point 2 above). html types those `class`.
  [/[^\s{}=]+/g, "class"],
];

/** A nested prop bag, wherever one can hang off a larger construct. */
const attrs: ShjRule = [RegExp(ATTRS, "g"), undefined, ATTR_RULES];

/**
 * The YAML prop block under a component:
 *
 *   ::card
 *   ---
 *   title: Getting Started
 *   icon: i-lucide-rocket
 *   ---
 *   Install undocs and scaffold your first docs site.
 *   ::
 *
 * This is by far the most common way undocs' own docs pass props, so leaving it
 * grey would waste most of the win.
 *
 * The lookbehind is the whole trick. A bare `^---$ … ^---$` rule would happily
 * pair a thematic break with an unrelated one three paragraphs later and
 * re-tokenize the prose between them as YAML. Requiring the opening `---` to sit
 * directly under a component line (or at the very start of the fence, which is
 * document frontmatter) restores the scoping that the missing begin/end state
 * would otherwise have provided.
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

/** `::note`, `  ::tab{label="npm"}`, `::::card { title="Card title" .red}`. */
const BLOCK_OPEN: ShjRule = [
  RegExp(String.raw`^[ \t]*:{2,}${NAME}(?:[ \t]*${ATTRS})?[ \t]*$`, "gm"),
  "kwd",
  [[/^[ \t]*:{2,}/g, "oper"], attrs],
];

/** The bare `::` (or `:::`, `::::`) that closes a block. */
const BLOCK_CLOSE: ShjRule = [/^[ \t]*:{2,}[ \t]*$/gm, "oper"];

/**
 * A named slot: `#title`, `#description`, `#links`, `#default`.
 *
 * Anchored at both ends, per the reference. A slot line holds the name and
 * nothing else; an ATX heading always has whitespace and text after its hashes,
 * so `#### Install the package` cannot reach this rule and `#description`
 * cannot reach `HEADING`. The two are mutually exclusive by construction, not
 * by rule order.
 */
const SLOT: ShjRule = [
  RegExp(String.raw`^[ \t]*#${NAME}[ \t]*$`, "gm"),
  "class",
  [[/^[ \t]*#/g, "oper"]],
];

/**
 * An ATX heading — the other half of the `#` disambiguation.
 *
 * rangi 2.1's `md` does now type ATX headings `section`, but as ONE flat token:
 * it cannot pick the `#` marker out from the text, and it swallows a trailing
 * prop bag whole. This rule keeps both — the `oper` hashes, and `attrs` for
 * comark's `## Hello{.text-red}` form. Being ahead of the spread `md` base, it
 * wins the tie at the shared start index.
 */
const HEADING: ShjRule = [
  /^[ \t]{0,3}#{1,6}[ \t]+[^\n]*/gm,
  "section",
  [[/^[ \t]*#{1,6}/g, "oper"], attrs],
];

/** The delimiters of a `[…]`, wherever one is matched as a unit. */
const BRACKET_RULES: ShjRule[] = [[/^\[|\]$/g, "oper"]];

/** `[slot text]` hanging off an inline component or a span. */
const bracketed: ShjRule = [/\[[^\]]*\]/g, "str", BRACKET_RULES];

/**
 * A SINGLE-colon inline component: `:pm-install{name="undocs"}`,
 * `:read-more{to="/guide" title="Get started"}`, `:icon[label]{.big}`.
 *
 * The lookbehind is what keeps this off everything else a colon does in prose —
 * `https://unjs.io`, `3:4`, `Note: see below` — and, more importantly, off the
 * second colon of a `::block` opener, which is never preceded by whitespace.
 * Both orders of the optional `[slot]` and `{attrs}` are accepted, as in the
 * reference.
 */
const INLINE: ShjRule = [
  RegExp(String.raw`(?<=^|\s):${NAME}(?:\[[^\]\n]*\])?(?:${ATTRS})?(?:\[[^\]\n]*\])?`, "gm"),
  "kwd",
  [[/^:/g, "oper"], attrs, bracketed],
];

/** A span: `[Amazing]{.text-primary}`. */
const SPAN: ShjRule = [
  RegExp(String.raw`\[[^\]\n]*\]${ATTRS}`, "g"),
  undefined,
  [[/^\[[^\]]*\]/g, "str", BRACKET_RULES], attrs],
];

/** A `{{ value }}` / `{{ value || fallback }}` binding. */
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

/**
 * A prop bag hanging off any other inline element: `**bold**{style="…"}`,
 * `[Link](https://unjs.io){class="x"}`, `` `code`{style="…"} ``.
 *
 * `(?<=\S)` — comark attaches a bag directly to the element it decorates, with
 * no space between. Requiring that is what stops the rule firing on a stray
 * `{ … }` in prose or in a nested fenced block (where a `{` is virtually always
 * preceded by a newline or a space). It also runs LAST so every construct that
 * owns its own bag has already consumed it.
 */
const ATTRS_ATTACHED: ShjRule = [RegExp(String.raw`(?<=\S)${ATTRS}`, "g"), undefined, ATTR_RULES];

/**
 * Ordering: these all sit ahead of the spread `md` base so they win a tie at a
 * shared index — which is what keeps md's `(=|-)\1+` rule from claiming the
 * `---` of a prop block, and its link rule from claiming the `[…]` of a span.
 */
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
