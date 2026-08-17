import { posix } from "node:path";
import type { MarkNode, MarkElement } from "./types.ts";
import { textContent, toRoutePath } from "./utils.ts";

const isEl = (n: MarkNode | undefined): n is MarkElement => Array.isArray(n);

/** Mutates parsed AST; `rel` anchors file-relative Markdown links. */
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

// File-relative content links must become route paths, including prefix stripping.
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

/**
 * Shared by rendered AST and raw-source routes so both expose identical links.
 * `baseDir` is relative to the docs root (`"."` for a root page).
 */
export function resolveMdHref(href: string, baseDir: string): string {
  // Leave external, protocol-relative, root-absolute, and anchor-only links unchanged.
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(href)) return href;
  const hashIdx = href.indexOf("#");
  const pathPart = hashIdx === -1 ? href : href.slice(0, hashIdx);
  const hash = hashIdx === -1 ? "" : href.slice(hashIdx);
  // Other relative links may target assets.
  if (!/\.(md|yml)$/i.test(pathPart)) return href;
  const resolved = posix.normalize(posix.join(baseDir === "." ? "" : baseDir, pathPart));
  // Escapes from the docs root cannot map to routes.
  if (resolved.startsWith("..")) return href;
  return toRoutePath(resolved) + hash;
}

// Unwrap component-only paragraphs; browser repair of `<p><div>` breaks hydration.
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
  // Raw inline HTML remains phrasing content before and after lifting.
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
      // Skip raw/code leaves containing verbatim strings.
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

function paragraphWrapsBlock(node: MarkElement): boolean {
  let hasBlock = false;
  for (const child of node.slice(2) as MarkNode[]) {
    if (typeof child === "string") {
      if (child.trim() !== "") return false;
      continue;
    }
    if (!isEl(child)) continue;
    const tag = child[0];
    if (tag === null) continue;
    if (tag && PHRASING_TAGS.has(tag)) return false;
    hasBlock = true;
  }
  return hasBlock;
}

// Unwrap exactly one bare slot paragraph; nested `<p>` repair breaks hydration.
// Preserve multi-block slots and explicitly-propped paragraphs for component layout.
function unwrapSlotParagraphs(nodes: MarkNode[], start = 0): void {
  for (let i = start; i < nodes.length; i++) {
    const node = nodes[i];
    if (!isEl(node)) continue;
    const tag = node[0];
    if (tag && RAW_SKIP.has(tag)) continue;
    if (tag === "template" && typeof (node[1] as any)?.name === "string") {
      const idx = loneParagraphIndex(node);
      // Preserve comment and whitespace siblings.
      if (idx !== -1) node.splice(idx, 1, ...((node[idx] as MarkElement).slice(2) as MarkNode[]));
    }
    // Start at tuple children, after tag and props.
    unwrapSlotParagraphs(node as unknown as MarkNode[], 2);
  }
}

function loneParagraphIndex(node: MarkElement): number {
  let found = -1;
  for (let i = 2; i < node.length; i++) {
    const child = node[i] as MarkNode;
    if (typeof child === "string") {
      if (child.trim() !== "") return -1;
      continue;
    }
    if (!isEl(child)) continue;
    const tag = child[0];
    if (tag === null) continue;
    if (found !== -1 || tag !== "p") return -1;
    if (child[1] && Object.keys(child[1]).length > 0) return -1;
    found = i;
  }
  return found;
}

// md4x distinguishes raw HTML from literal `<`; Vue safely escapes the latter.
// An inline `html` node is one tag, so merge matched pairs with plain-text interiors
// before `v-html`; real child elements would require an AST-to-HTML serializer.
const RAW_SKIP = new Set(["pre", "code", "mermaid", "_html", "html"]);

function liftRawHtml(nodes: MarkNode[], start = 0): void {
  for (let i = start; i < nodes.length; i++) {
    const child = nodes[i];
    if (!isEl(child)) continue;
    const tag = child[0];
    if (tag === "html") {
      const source = htmlSource(child);
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
    // Recurse from tuple children, after tag and props.
    liftRawHtml(child as unknown as MarkNode[], 2);
  }
}

function htmlSource(node: MarkElement): string {
  return typeof node[2] === "string" ? node[2] : "";
}

/**
 * Escape resolved AST text, including `&`, before returning it to `innerHTML`;
 * surrounding `html` nodes remain verbatim source.
 */
function inlineSource(node: MarkNode): string {
  if (typeof node === "string") {
    return node.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }
  return isEl(node) ? htmlSource(node) : "";
}

// Void elements never open a mergeable run.
// prettier-ignore
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img",
  "input", "link", "meta", "param", "source", "track", "wbr",
]);

function isOpenTag(source: string): boolean {
  const m = /^<([a-z][\w:-]*)/i.exec(source);
  if (!m || source.endsWith("/>")) return false;
  return !VOID_TAGS.has(m[1].toLowerCase());
}

// Reject unclosed runs or real AST children; count nested inline tags.

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

// Normalize container alert types to md4x's lowercase GitHub-alert casing.
function normalizeAlert(node: MarkElement) {
  if (node[0] === "alert" && node[1] && typeof node[1].type === "string") {
    node[1].type = node[1].type.toLowerCase();
  }
}

function transformMermaid(node: MarkElement) {
  if (node[0] === "pre" && (node[1] as any)?.language === "mermaid") {
    const code = textContent(node);
    node[0] = "mermaid";
    node[1] = { code };
    node.splice(2);
  }
}

// Keep list content verbatim; synthesizing headings adds bogus deep links.
function transformStepsList(node: MarkElement) {
  if (node[0] === "ol" && node.length > 3 && isEl(node[2]) && node[2][0] === "li") {
    const steps = (node.slice(2) as MarkElement[]).map(
      (li) => ["div", { class: "step" }, ...li.slice(2)] as MarkElement,
    );
    node.splice(0, Infinity, "steps", {}, ...steps);
  }
}

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
