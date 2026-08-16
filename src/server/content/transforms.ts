// Tests: test/content/transforms.test.ts
import { posix } from "node:path";
import type { MarkNode, MarkElement } from "./types.ts";
import { textContent, toRoutePath } from "./utils.ts";

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
  unwrapSlotParagraphs(value);
  transformLinks(value, rel ? posix.dirname(rel) : undefined);
  for (const node of value) {
    if (!isEl(node)) continue;
    transformStepsList(node);
    transformMermaid(node);
    normalizeAlert(node);
  }
  liftRawHtml(value);
  return value;
}

// --- link fixups: drop `autolink`, rewrite relative `.md`/`.yml` hrefs ---
// md4x marks a bare `<https://…>` with `autolink: true`. Nothing here renders an
// autolink differently, and every prop on an `a` node is spread onto the anchor
// by `MarkdownRenderer`, so leaving it emits `<a autolink="true">` into the page
// (and ships the prop in every payload). Dropped at the source instead.
//
// Markdown source links between pages point at files (`./02.foo.md`,
// `../guide/1.index.md#anchor`). Those hrefs must become the route paths the
// router serves (`/spec/foo`, `/guide#anchor`) — same numeric-prefix stripping
// and extension removal `toRoutePath` applies to a page's own path. Left as-is
// they 404, and the `NN.` prefix leaks into the URL. Only that half needs the
// page's own directory, so it is what `baseDir` gates.
function transformLinks(nodes: MarkNode[], baseDir?: string): void {
  for (const node of nodes) {
    if (!isEl(node)) continue;
    const tag = node[0];
    if (tag === "a") {
      const props = node[1] as Record<string, any> | undefined;
      if (props) {
        delete props.autolink;
        if (baseDir !== undefined && typeof props.href === "string") {
          props.href = resolveMdHref(props.href, baseDir);
        }
      }
    }
    if (tag && RAW_SKIP.has(tag)) continue;
    transformLinks(node.slice(2) as MarkNode[], baseDir);
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
  // Raw HTML, before (`html`) and after (`_html`) `liftRawHtml`. A paragraph of
  // nothing but inline tags is prose the author wrote inline, not a block.
  "html",
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

// --- unwrap the paragraph md4x wraps a one-line slot fill in ---
// `#description` followed by a line of prose parses as a block, so the slot
// template holds a `<p>`. Components render a named slot as the CONTENT of an
// element they choose — `<p class="…"><slot name="description"/></p>`, a heading,
// a label — so that paragraph is redundant at best. At worst it is a `<p>` inside
// a `<p>`: invalid, and the browser's repair (hoist the inner one, synthesize an
// empty one for the now-stray end tag) yields a DOM that no longer matches the
// vdom, so hydration mismatches.
//
// Only a slot filled with exactly ONE bare paragraph is unwrapped — that is prose
// the author typed inline. Two paragraphs, a list, or a nested component is block
// content the component is expected to lay out, and is left alone; so is a
// paragraph carrying props (`{.text-lg}`), which the author asked for explicitly.
function unwrapSlotParagraphs(nodes: MarkNode[], start = 0): void {
  for (let i = start; i < nodes.length; i++) {
    const node = nodes[i];
    if (!isEl(node)) continue;
    const tag = node[0];
    if (tag && RAW_SKIP.has(tag)) continue;
    if (tag === "template" && typeof (node[1] as any)?.name === "string") {
      const idx = loneParagraphIndex(node);
      // Splice in place rather than rebuilding the child list, so any comment or
      // whitespace sibling of the paragraph survives.
      if (idx !== -1) node.splice(idx, 1, ...((node[idx] as MarkElement).slice(2) as MarkNode[]));
    }
    // `node` is a `[tag, props, ...MarkNode[]]` tuple; `start = 2` skips the
    // tag/props, so treating it as a node array is safe.
    unwrapSlotParagraphs(node as unknown as MarkNode[], 2);
  }
}

/**
 * Index of the slot's only child paragraph, or `-1` when it holds anything else
 * (real text, a second element, a paragraph with props). Whitespace strings and
 * comments don't count against it.
 */
function loneParagraphIndex(node: MarkElement): number {
  let found = -1;
  for (let i = 2; i < node.length; i++) {
    const child = node[i] as MarkNode;
    if (typeof child === "string") {
      if (child.trim() !== "") return -1; // real text -> nothing to unwrap
      continue;
    }
    if (!isEl(child)) continue;
    const tag = child[0];
    if (tag === null) continue; // HTML comment
    if (found !== -1 || tag !== "p") return -1;
    if (child[1] && Object.keys(child[1]).length > 0) return -1;
    found = i;
  }
  return found;
}

// --- raw HTML in markdown -> `_html` node rendered via `v-html` ---
// md4x TAGS raw HTML rather than leaving it in the text: a block fence arrives
// as `["html", { block: true }, source]` and an inline tag as `["html", {}, "<b>"]`.
// So a plain `<` is now just a string (`3 < 5` stays `"3 < 5"`) and needs no
// sniffing — Vue escapes it as a text node, which is both simpler and safer than
// the old scan-every-string-for-`<` pass this replaces.
//
// Both kinds become `_html` nodes the renderer injects with `innerHTML`. A block
// one maps 1:1. An inline node is ONE TAG, not an element, so an open/close pair
// arrives as two nodes with the content between them: split across two `_html`
// spans the browser closes `<span><b></span>` on its own and the markup is lost,
// so a matched pair is merged with its interior into a single node.
//
// That merge is only possible while the interior is plain text — a run holding a
// real element (a link, `**bold**`) would have to be serialized back to HTML,
// which is a renderer, not a transform. Those fragments are emitted one by one
// instead, which is exactly what happened before md4x could tell a tag from a `<`.
const RAW_SKIP = new Set(["pre", "code", "mermaid", "_html", "html"]);

function liftRawHtml(nodes: MarkNode[], start = 0): void {
  for (let i = start; i < nodes.length; i++) {
    const child = nodes[i];
    if (!isEl(child)) continue;
    const tag = child[0];
    if (tag === "html") {
      const source = htmlSource(child);
      // A block-level HTML fence is already raw HTML — pass it through verbatim.
      if (child[1]?.block) {
        nodes[i] = ["_html", { block: true }, source];
        continue;
      }
      const close = closingIndex(nodes, i);
      if (close === -1) {
        nodes[i] = ["_html", {}, source];
        continue;
      }
      const merged = (nodes.slice(i, close + 1) as MarkNode[]).map(inlineSource).join("");
      nodes.splice(i, close - i + 1, ["_html", {}, merged]);
      continue;
    }
    if (tag && RAW_SKIP.has(tag)) continue;
    // Recurse into this element's children (indices 2..end), mutating in place.
    // `child` is a `[tag, props, ...MarkNode[]]` tuple; `start = 2` skips the
    // tag/props, so treating it as a node array is safe.
    liftRawHtml(child as unknown as MarkNode[], 2);
  }
}

/** The verbatim markup an `["html", props, source]` node carries. */
function htmlSource(node: MarkElement): string {
  return typeof node[2] === "string" ? node[2] : "";
}

/**
 * One node of a merged inline run, as HTML source.
 *
 * Text between the tags is PLAIN text — md4x resolves entities in the AST's text
 * nodes, so an authored `&copy;` arrives as `©` — and it is about to be handed to
 * `innerHTML`, so it needs the full escape, `&` included, or that `©` would go
 * back in as an entity to decode a second time. The `html` nodes around it are
 * source and pass through verbatim, which is why `innerHTML` still resolves the
 * entities the author wrote INSIDE a tag. Callers only pass strings and `html`
 * nodes; `closingIndex` guarantees a run holds nothing else.
 */
function inlineSource(node: MarkNode): string {
  if (typeof node === "string") {
    return node.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }
  return isEl(node) ? htmlSource(node) : "";
}

/**
 * Void elements never open a run: they have no closing tag to look for, so a
 * `<br>` between two paragraphs' worth of prose must not swallow it.
 */
// prettier-ignore
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img",
  "input", "link", "meta", "param", "source", "track", "wbr",
]);

/** Does this markup open an element that something later has to close? */
function isOpenTag(source: string): boolean {
  const m = /^<([a-z][\w:-]*)/i.exec(source);
  if (!m || source.endsWith("/>")) return false;
  return !VOID_TAGS.has(m[1].toLowerCase());
}

/**
 * Index of the inline `html` node closing the tag opened at `open`, or `-1` when
 * the tag opens nothing, is never closed, or its run spans a node the merge
 * cannot express as HTML source (anything but text and further inline tags).
 * Nesting is counted, so `<b>x <i>y</i> z</b>` closes at the LAST node.
 */
function closingIndex(nodes: MarkNode[], open: number): number {
  if (!isOpenTag(htmlSource(nodes[open] as MarkElement))) return -1;
  let depth = 0;
  for (let i = open; i < nodes.length; i++) {
    const node = nodes[i];
    if (typeof node === "string") continue;
    if (!isEl(node) || node[0] !== "html" || node[1]?.block) return -1;
    if (isOpenTag(htmlSource(node))) depth++;
    else if (htmlSource(node).startsWith("</") && --depth === 0) return i;
  }
  return -1;
}

// --- github/container alerts -> normalized `alert` node ---
// md4x lowercases the type it reads out of `> [!NOTE]` itself, but `::alert{type=X}`
// is an author-typed prop and arrives verbatim. Normalize the casing so a single
// Alert component can switch on it either way.
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
// An auto-generated step is just a list item styled better: its content is kept
// verbatim inside a `.step` wrapper and the number comes from a CSS counter. It
// deliberately does NOT synthesize a heading — that made the item's text (and,
// before, its whole body) render bold and injected bogus `#` deep-links.
// The hand-authored `::steps` form still numbers its own headings; see Steps.vue.
function transformStepsList(node: MarkElement) {
  if (node[0] === "ol" && node.length > 3 && isEl(node[2]) && node[2][0] === "li") {
    const steps = (node.slice(2) as MarkElement[]).map(
      (li) => ["div", { class: "step" }, ...li.slice(2)] as MarkElement,
    );
    node.splice(0, Infinity, "steps", {}, ...steps);
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
