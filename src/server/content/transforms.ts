// Tests: test/content/transforms.test.ts
import { posix } from "node:path";
import * as md4x from "md4x/wasm";
import type { MarkNode, MarkElement } from "./types";
import { textContent, toRoutePath } from "./utils";

const isEl = (n: MarkNode | undefined): n is MarkElement => Array.isArray(n);

/**
 * Apply block-level AST transforms to a body node list (mutates & returns).
 * Runs after the markdown is parsed, before it is stored/rendered.
 *
 * `rel` is the page's source-relative path (e.g. `2.spec/12.pack-format.md`);
 * it anchors resolution of relative `.md` links to route paths.
 */
export function transformBody(nodes: MarkNode[], rel?: string): MarkNode[] {
  let value = mergeCodeGroups(nodes);
  value = unwrapBlockParagraphs(value);
  if (rel) resolveLinks(value, posix.dirname(rel));
  for (const node of value) {
    if (!isEl(node)) continue;
    transformStepsList(node);
    transformMermaid(node);
    normalizeAlert(node);
  }
  liftRawHtml(value);
  return value;
}

// --- relative `.md`/`.yml` links -> route paths ---
// Markdown source links between pages point at files (`./02.foo.md`,
// `../guide/1.index.md#anchor`). Those hrefs must become the route paths the
// router serves (`/spec/foo`, `/guide#anchor`) — same numeric-prefix stripping
// and extension removal `toRoutePath` applies to a page's own path. Left as-is
// they 404, and the `NN.` prefix leaks into the URL.
function resolveLinks(nodes: MarkNode[], baseDir: string): void {
  for (const node of nodes) {
    if (!isEl(node)) continue;
    const tag = node[0];
    if (tag === "a") {
      const props = node[1] as Record<string, any> | undefined;
      if (props && typeof props.href === "string") {
        props.href = resolveMdHref(props.href, baseDir);
      }
    }
    if (tag && RAW_SKIP.has(tag)) continue;
    resolveLinks(node.slice(2) as MarkNode[], baseDir);
  }
}

function resolveMdHref(href: string, baseDir: string): string {
  // Leave external (`https:`, `mailto:`), protocol-relative (`//`), root-absolute
  // (`/`), and anchor-only (`#`) links untouched.
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(href)) return href;
  const hashIdx = href.indexOf("#");
  const pathPart = hashIdx === -1 ? href : href.slice(0, hashIdx);
  const hash = hashIdx === -1 ? "" : href.slice(hashIdx);
  // Only rewrite links that target a content file; leave other relative links
  // (images, assets) alone.
  if (!/\.(md|yml)$/i.test(pathPart)) return href;
  const resolved = posix.normalize(posix.join(baseDir === "." ? "" : baseDir, pathPart));
  // A link escaping the docs root can't map to a route — keep it verbatim.
  if (resolved.startsWith("..")) return href;
  return toRoutePath(resolved) + hash;
}

// --- unwrap block-level components from the paragraph md4x wraps them in ---
// A lone inline component (`:pm-x{…}`) on its own line is parsed as inline
// content and wrapped in a `<p>`, but renders block markup (a `<div>`) — invalid
// inside `<p>`, so the browser hoists it out, causing a hydration mismatch.
// unwrap any paragraph whose content is purely
// block-level component(s). "Block-level" = not in the phrasing set below;
// custom components aren't phrasing and render as `<div>`.
const PHRASING_TAGS = new Set([
  "a",
  "code",
  "strong",
  "em",
  "del",
  "span",
  "sup",
  "sub",
  "kbd",
  "img",
  "br",
  "abbr",
  "mark",
  "small",
  "s",
  "u",
  "input",
  "_html",
  "template",
  "wbr",
  "q",
  "cite",
  "time",
  "var",
  "samp",
  "bdi",
  "bdo",
]);

function unwrapBlockParagraphs(nodes: MarkNode[]): MarkNode[] {
  const out: MarkNode[] = [];
  for (const node of nodes) {
    if (isEl(node)) {
      const tag = node[0];
      // Recurse into container children first (e.g. a `:pm-x{}` inside a
      // `::note` block), skipping raw/code leaves that hold verbatim strings.
      if (tag && !RAW_SKIP.has(tag)) {
        const inner = unwrapBlockParagraphs(node.slice(2) as MarkNode[]);
        (node as MarkNode[]).splice(2, node.length - 2, ...inner);
      }
      if (tag === "p" && paragraphWrapsBlock(node)) {
        for (const child of node.slice(2) as MarkNode[]) {
          if (typeof child === "string" && child.trim() === "") continue;
          out.push(child);
        }
        continue;
      }
    }
    out.push(node);
  }
  return out;
}

/**
 * True when a `<p>`'s children are whitespace/comments plus at least one
 * block-level (non-phrasing) element — and no real text or inline element that
 * would need to stay wrapped in the paragraph.
 */
function paragraphWrapsBlock(node: MarkElement): boolean {
  let hasBlock = false;
  for (const child of node.slice(2) as MarkNode[]) {
    if (typeof child === "string") {
      if (child.trim() !== "") return false; // real text -> keep the paragraph
      continue;
    }
    if (!isEl(child)) continue;
    const tag = child[0];
    if (tag === null) continue; // HTML comment
    if (tag && PHRASING_TAGS.has(tag)) return false; // inline content present
    hasBlock = true;
  }
  return hasBlock;
}

// --- raw HTML in markdown -> `_html` node rendered via `v-html` ---
// md4x keeps raw HTML as literal characters in text strings, indistinguishable
// from a plain `<` (e.g. `3 < 5` stays `"3 < 5"`). Resolved server-side:
// `renderToHtml` escapes literal `<` while preserving real tags; wrapped in an
// `_html` node the renderer injects via `innerHTML`. Only strings with `<` are touched.
const RAW_SKIP = new Set(["pre", "code", "mermaid", "_html"]);

function liftRawHtml(nodes: MarkNode[], start = 0): void {
  for (let i = start; i < nodes.length; i++) {
    const child = nodes[i];
    if (typeof child === "string") {
      if (child.includes("<")) nodes[i] = ["_html", {}, renderInlineHtml(child)];
      continue;
    }
    if (!isEl(child)) continue;
    const tag = child[0];
    // A block-level HTML fence is already raw HTML — pass it through verbatim.
    if (tag === "html_block") {
      nodes[i] = ["_html", { block: true }, typeof child[2] === "string" ? child[2] : ""];
      continue;
    }
    if (tag && RAW_SKIP.has(tag)) continue;
    // Recurse into this element's children (indices 2..end), mutating in place.
    // `child` is a `[tag, props, ...MarkNode[]]` tuple; `start = 2` skips the
    // tag/props, so treating it as a node array is safe.
    liftRawHtml(child as unknown as MarkNode[], 2);
  }
}

/**
 * Render one inline text fragment (markdown-escaped by md4x) to HTML and strip
 * the single `<p>…</p>` wrapper `renderToHtml` adds, yielding inline-level HTML.
 */
function renderInlineHtml(str: string): string {
  const out = md4x.renderToHtml(str).trim();
  const m = out.match(/^<p>([\s\S]*)<\/p>$/);
  return m ? m[1] : out;
}

// --- github/container alerts -> normalized `alert` node ---
// md4x emits `> [!NOTE]` as ["alert", { type: "NOTE" }] and `::alert{type=x}`
// as ["alert", { type: "x" }]. Normalize the type casing so a single Alert
// component can switch on it.
function normalizeAlert(node: MarkElement) {
  if (node[0] === "alert" && node[1] && typeof node[1].type === "string") {
    node[1].type = node[1].type.toLowerCase();
  }
}

// --- mermaid code fences -> <mermaid> node ---
function transformMermaid(node: MarkElement) {
  if (node[0] === "pre" && (node[1] as any)?.language === "mermaid") {
    const code = textContent(node);
    node[0] = "mermaid";
    node[1] = { code };
    node.splice(2);
  }
}

// --- ordered list -> steps ---
function transformStepsList(node: MarkElement) {
  if (node[0] === "ol" && node.length > 3 && isEl(node[2]) && node[2][0] === "li") {
    const stepsChildren = (node.slice(2) as MarkElement[]).map(
      (li) => ["h4", {}, ...li.slice(2)] as MarkElement,
    );
    node.splice(0, Infinity, "steps", { level: "4" }, ...stepsChildren);
  }
}

// --- merge consecutive named code blocks into a code-group ---
function mergeCodeGroups(children: MarkNode[] = []): MarkNode[] {
  const out: MarkNode[] = [];
  let group: MarkNode[] = [];
  for (const child of children) {
    if (isNamedCodeBlock(child)) {
      group.push(child);
      continue;
    }
    if (group.length > 0) {
      out.push(group.length > 1 ? (["code-group", {}, ...group] as MarkElement) : group[0]);
      group = [];
    }
    out.push(child);
  }
  if (group.length > 0) {
    out.push(group.length > 1 ? (["code-group", {}, ...group] as MarkElement) : group[0]);
  }
  return out;
}

function isNamedCodeBlock(node: MarkNode): boolean {
  return (
    isEl(node) &&
    node[0] === "pre" &&
    !!(node[1] as any)?.filename &&
    isEl(node[2]) &&
    (node[2] as MarkElement)[0] === "code"
  );
}
