// Tests: test/content/highlight.test.ts
import type { MarkNode, MarkElement } from "./types";
import { textContent } from "./utils";
import { highlightText } from "rangi";
import {
  BUNDLED_ALIASES,
  BUNDLED_LANGS,
  LOCAL_ALIASES,
  LOCAL_LANG_NAMES,
  LOCAL_LANGUAGES,
} from "./grammars";

/**
 * Every name we can highlight: everything rangi answers to — its languages and
 * its own aliases alike — plus the grammars we define under `grammars/`.
 */
const KNOWN_LANGS = new Set([...BUNDLED_LANGS, ...LOCAL_LANG_NAMES]);

/**
 * Markdown fence infostrings → language names, for the spellings rangi does NOT
 * already answer to.
 *
 * rangi 2.1 ships its own alias registry (`javascript`, `yml`, `sh`, `python`,
 * `dockerfile`, `jsonc`, … — 39 of them), spread into the same `languages`
 * record as the grammars, so those names resolve through `KNOWN_LANGS` with no
 * entry here. What is left is the two kinds of mapping rangi has no reason to
 * make itself:
 *
 * - deliberate APPROXIMATIONS, where we accept a near-miss over grey text:
 *   `mdx` as markdown, `console` as bash, `sass` as scss, `tsv` as csv, and
 *   dotenv/properties as ini;
 * - vendor spellings rangi skips: the VS Code language IDs (`shellscript`,
 *   `javascriptreact`) and `c++`.
 *
 * `text`/`txt`/`plaintext` map to the empty string ON PURPOSE. rangi aliases
 * those onto its `plain` grammar, which tokenizes nothing; routing them to a
 * bare escaped `<pre>` instead keeps the markup smaller and the wrapper class
 * honest. Anything unmapped and not in `KNOWN_LANGS` lands there too.
 *
 * Aliases for LOCAL grammars are declared on the grammar itself and merged in
 * here, so adding a language never means editing this file.
 */
const LANG_ALIASES: Record<string, string> = {
  ...LOCAL_ALIASES,
  shellscript: "bash",
  console: "bash",
  mdx: "md",
  sass: "scss",
  "c++": "cpp",
  tsv: "csv",
  env: "ini",
  dotenv: "ini",
  properties: "ini",
  javascriptreact: "jsx",
  typescriptreact: "tsx",
  "json-c": "jsonc",
  text: "",
  txt: "",
  plain: "",
  plaintext: "",
};

/**
 * Resolve a fence infostring to a CANONICAL grammar name, or `undefined` if we
 * cannot highlight it.
 *
 * Two hops: our table above, then rangi's own aliases. The second hop is what
 * collapses every spelling of a language onto one name, so `js`, `javascript`
 * and `mjs` all render `code-hl-lang-js` and a stylesheet keying off that class
 * needs one selector rather than three.
 */
function resolveLang(lang: string): string | undefined {
  const name = LANG_ALIASES[lang] ?? lang;
  if (!name || !KNOWN_LANGS.has(name)) return undefined;
  return BUNDLED_ALIASES[name] ?? name;
}

/**
 * Highlight a single code string to inline-styled HTML.
 *
 * SYNCHRONOUS — rangi returns its result directly rather than as a promise.
 * (`highlightBody` below stays async only because it is a tree walk with an
 * async signature its caller already awaits.)
 *
 * `inline: true` returns bare tokens — no line-number gutter, no flex wrapper —
 * which we wrap ourselves in `<pre class="code-hl code-hl-lang-*"><code>`.
 *
 * `classes: true` makes each token a `<span class="shj-<type>">` instead of a
 * `<span style="color:light-dark(…)">`. The palette moves to `assets/main.css`,
 * which is where it has to be for the markup to stay small: a colour inlined on
 * every token is repeated once per token in every page's HTML, where a class
 * name is a handful of bytes and the colours are downloaded once, in a file the
 * browser already caches. rangi still resolves the two themes through
 * `light-dark()`, just in the stylesheet — so `useColorMode` keeping
 * `color-scheme` in step remains what picks the branch.
 *
 * Local grammars are passed per call via `languages` — no registration step and
 * no shared mutable cache.
 *
 * Unknown/unmapped languages and any highlighter failure fall back to an
 * escaped plain `<pre>`.
 *
 * Shared by `highlightBody` (doc content) and the config route (landing hero
 * code) so both go through the exact same grammars and options.
 */
export function highlightCode(code: string, lang = "text"): string {
  const name = resolveLang(lang);
  if (name) {
    try {
      const tokens = highlightText(code, {
        lang: name,
        languages: LOCAL_LANGUAGES,
        inline: true,
        classes: true,
      });
      return `<pre class="code-hl code-hl-lang-${name}"><code>${tokens}</code></pre>`;
    } catch {
      // fall through to escaped plain <pre>
    }
  }
  return `<pre><code>${escapeHtml(code)}</code></pre>`;
}

/**
 * Walk the body and replace `pre > code` blocks with highlighted HTML.
 * Stores the token markup on the node so the client can render it with
 * `v-html` and recolor it with the color mode.
 *
 * Returns the number of code blocks highlighted (used by the build stats).
 * Synchronous, like `highlightCode`.
 */
export function highlightBody(nodes: MarkNode[]): number {
  let count = 0;
  const walk = (list: MarkNode[]) => {
    for (const node of list) {
      if (!isEl(node)) continue;
      if (node[0] === "pre") {
        const props = (node[1] ||= {}) as Record<string, any>;
        const lang = String(props.language || "text");
        const code = textContent(node).replace(/\n$/, "");
        props.code = code;
        props.highlighted = highlightCode(code, lang);
        count++;
        continue; // don't descend into code children
      }
      walk(node.slice(2) as MarkNode[]);
    }
  };
  walk(nodes);
  return count;
}

const isEl = (n: MarkNode | undefined): n is MarkElement => Array.isArray(n);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
