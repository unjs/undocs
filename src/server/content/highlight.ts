// Tests: test/content/highlight.test.ts
import type { HighlighterCore } from "shiki/core";
import type { MarkNode, MarkElement } from "./types";
import { textContent } from "./utils";

// Fine-grained bundle (not `shiki/bundle/full`, which pulls in every grammar);
// each lang module carries its own aliases/deps, so short names still resolve.
// `.mjs` suffix is load-bearing: shiki's extensionless `"./*"` export map needs
// it for TS to find the sibling `.d.mts` (else TS2307).
const THEMES = [import("shiki/themes/vesper.mjs"), import("shiki/themes/min-light.mjs")];

// prettier-ignore
const LANGS = [
  import("shiki/langs/json.mjs"), import("shiki/langs/json5.mjs"), import("shiki/langs/jsonc.mjs"),
  import("shiki/langs/toml.mjs"), import("shiki/langs/yaml.mjs"), import("shiki/langs/html.mjs"),
  import("shiki/langs/bash.mjs"), import("shiki/langs/mdc.mjs"), import("shiki/langs/markdown.mjs"),
  import("shiki/langs/vue.mjs"), import("shiki/langs/javascript.mjs"), import("shiki/langs/typescript.mjs"),
  import("shiki/langs/ini.mjs"), import("shiki/langs/diff.mjs"), import("shiki/langs/jsx.mjs"),
  import("shiki/langs/tsx.mjs"),
];

let highlighterPromise: Promise<HighlighterCore> | undefined;

async function getHighlighter() {
  if (!highlighterPromise) {
    // `shiki/core` + the oniguruma wasm engine only — no `@shikijs/engine-javascript`,
    // whose `createJavaScriptRegexEngine` panics rolldown during the server bundle.
    // `shiki/wasm` resolves to `onig.wasm` under Nitro's unwasm plugin (the `unwasm`
    // export condition), so the wasm bundles normally with no need to externalize it.
    highlighterPromise = Promise.all([import("shiki/core"), import("shiki/engine/oniguruma")]).then(
      ([{ createHighlighterCore }, { createOnigurumaEngine }]) =>
        createHighlighterCore({
          themes: THEMES,
          langs: LANGS,
          engine: createOnigurumaEngine(import("shiki/wasm")),
        }),
    );
  }
  return highlighterPromise;
}

const isEl = (n: MarkNode | undefined): n is MarkElement => Array.isArray(n);

/**
 * Highlight a single code string to dual-theme (CSS variable based) HTML.
 * Every token carries `--shiki-light` / `--shiki-dark` (`defaultColor: false`)
 * so the client can render it with `v-html` and switch with the color mode.
 * Unknown/unloaded languages and any shiki failure fall back to escaped `<pre>`.
 *
 * Shared by `highlightBody` (doc content) and the config route (landing hero
 * code) so both go through the exact same highlighter instance and options.
 */
export async function highlightCode(code: string, lang = "text"): Promise<string> {
  const hl = await getHighlighter();
  const loaded = new Set(hl.getLoadedLanguages());
  try {
    if (lang !== "text" && loaded.has(lang)) {
      return hl.codeToHtml(code, {
        lang,
        themes: { light: "min-light", dark: "vesper" },
        defaultColor: false,
      });
    }
  } catch {
    // fall through to escaped plain <pre>
  }
  return `<pre><code>${escapeHtml(code)}</code></pre>`;
}

/**
 * Walk the body and replace `pre > code` blocks with highlighted HTML.
 * Stores dual-theme (CSS variable based) HTML on the node so the client can
 * render it with `v-html` and switch with the color mode.
 *
 * Returns the number of code blocks highlighted (used by the build stats).
 */
export async function highlightBody(nodes: MarkNode[]): Promise<number> {
  let count = 0;
  const walk = async (list: MarkNode[]) => {
    for (const node of list) {
      if (!isEl(node)) continue;
      if (node[0] === "pre") {
        const props = (node[1] ||= {}) as Record<string, any>;
        const lang = String(props.language || "text");
        const code = textContent(node).replace(/\n$/, "");
        props.code = code;
        props.highlighted = await highlightCode(code, lang);
        count++;
        continue; // don't descend into code children
      }
      await walk(node.slice(2) as MarkNode[]);
    }
  };
  await walk(nodes);
  return count;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
