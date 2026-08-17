import type { MarkNode, MarkElement } from "./types.ts";
import { textContent } from "./utils.ts";
import { highlightText } from "rangi";
import {
  BUNDLED_ALIASES,
  BUNDLED_LANGS,
  LOCAL_ALIASES,
  LOCAL_LANG_NAMES,
  LOCAL_LANGUAGES,
} from "./grammars/index.ts";

const KNOWN_LANGS = new Set([...BUNDLED_LANGS, ...LOCAL_LANG_NAMES]);

// Only gaps in rangi's aliases: deliberate approximations and vendor spellings.
// Plain-text names map empty to avoid a tokenless grammar and dishonest wrapper class.

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

// Canonicalize aliases so each grammar gets one `code-hl-lang-*` class.

function resolveLang(lang: string): string | undefined {
  const name = LANG_ALIASES[lang] ?? lang;
  if (!name || !KNOWN_LANGS.has(name)) return undefined;
  return BUNDLED_ALIASES[name] ?? name;
}

/**
 * Synchronous shared highlighter for docs and landing code. Class-based tokens
 * keep colors out of repeated markup; local grammars are per-call, never global.
 * Unknown languages and failures return escaped plain code.
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
      // Fall back to escaped plain code.
    }
  }
  return `<pre><code>${escapeHtml(code)}</code></pre>`;
}

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
        continue;
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
