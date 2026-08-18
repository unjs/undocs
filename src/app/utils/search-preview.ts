/**
 * What the search palette's preview pane reads out of a page, in two forms.
 *
 * `previewNodes` is the real one: the page's own comark AST, sliced from the
 * matched heading and handed to `MarkdownRenderer`, so the pane shows the page
 * as the page renders it — build-time rangi highlighting, callouts, tables,
 * inline formatting and all. Re-parsing markdown in the browser would throw all
 * of that away (and pull a wasm parser into the palette) to arrive somewhere
 * strictly worse: the AST we already fetched is the transformed, highlighted one.
 *
 * `previewBlocks` is the FALLBACK: a flat text outline the pane renders while
 * `MarkdownRenderer`'s chunk is still loading. It resolves synchronously from
 * the same AST, so the pane has real content in it from the first frame.
 *
 * Both slice from the matched heading ONWARD rather than stopping at the section
 * boundary, so a short section does not leave the pane half empty. That is also
 * why headings keep their parser-assigned `id`: it is the only thing tying a
 * search hit (`/guide/install#options`) back to a position in the page.
 */
import { slugify, textContent } from "@server/content/utils.ts";
import type { MarkElement, MarkNode } from "@server/content/types.ts";
import { matchRanges, toSegments } from "./search-highlight.ts";

export type PreviewBlockKind = "heading" | "text" | "quote" | "list" | "code" | "row";

export interface PreviewBlock {
  kind: PreviewBlockKind;
  text: string;
  /** `heading` only: 1–6, as authored. */
  depth?: number;
  /** `heading` only: md4x's anchor for the heading. */
  id?: string;
  /** `code` only: the fence's language, for the corner label. */
  lang?: string;
}

const HEADING = /^h([1-6])$/;

// Carry no readable prose, or repeat text a sibling block already contributes.
const SKIP = new Set(["img", "hr", "br", "style", "script", "thead", "template"]);

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function push(out: PreviewBlock[], block: PreviewBlock): void {
  if (block.text) out.push(block);
}

function walk(nodes: MarkNode[], out: PreviewBlock[]): void {
  for (const node of nodes) {
    if (typeof node === "string") {
      push(out, { kind: "text", text: clean(node) });
      continue;
    }
    if (!Array.isArray(node)) continue;
    const tag = node[0];
    // `[null, …]` is an AST comment.
    if (typeof tag !== "string") continue;
    if (SKIP.has(tag)) continue;
    const props = (node[1] || {}) as Record<string, any>;
    const children = node.slice(2) as MarkNode[];

    const heading = HEADING.exec(tag);
    if (heading) {
      push(out, {
        kind: "heading",
        text: clean(textContent(node)),
        depth: Number(heading[1]),
        id: typeof props.id === "string" ? props.id : undefined,
      });
      continue;
    }

    switch (tag) {
      // The highlighted markup lives in `props.highlighted`; `props.code` is the
      // same fence as source, which is what a text preview wants.
      case "pre": {
        const code = typeof props.code === "string" ? props.code : textContent(node);
        push(out, {
          kind: "code",
          text: code.replace(/\s+$/, ""),
          lang: typeof props.language === "string" ? props.language : undefined,
        });
        break;
      }
      case "p":
        push(out, { kind: "text", text: clean(textContent(node)) });
        break;
      case "blockquote":
        push(out, { kind: "quote", text: clean(textContent(node)) });
        break;
      // Nested lists flatten into their parent item rather than nesting the pane.
      case "li":
        push(out, { kind: "list", text: clean(textContent(node)) });
        break;
      // Cells are cleaned individually, so the wide separator survives the join.
      case "tr":
        push(out, {
          kind: "row",
          text: children
            .map((cell) => clean(textContent(cell)))
            .filter(Boolean)
            .join("  ·  "),
        });
        break;
      // Block-level raw HTML resolves to "" here (see `textContent`); inline raw
      // HTML is unwrapped to its prose, which is what belongs in a text preview.
      case "html":
      case "_html":
        push(out, { kind: "text", text: clean(textContent(node)) });
        break;
      default:
        walk(children, out);
    }
  }
}

/** Flatten a whole page body. Cache the result — this walks the entire AST. */
export function previewBlocks(body: MarkNode[] | undefined | null): PreviewBlock[] {
  const out: PreviewBlock[] = [];
  walk(body || [], out);
  return out;
}

/**
 * Where the pane should start reading for a hit on `anchor`. A page-level hit
 * (no anchor) starts at the top; an anchor md4x never emitted (a stale link, a
 * heading inside raw HTML) also starts at the top rather than showing nothing.
 */
export function anchorIndex(blocks: PreviewBlock[], anchor?: string): number {
  if (!anchor) return 0;
  const at = blocks.findIndex((b) => b.kind === "heading" && b.id === anchor);
  return at === -1 ? 0 : at;
}

/* -------------------------------------------------------------------------- *
 * The rendered path: the page's own AST, sliced and marked.
 * -------------------------------------------------------------------------- */

/** How many TOP-LEVEL nodes the pane will render past the matched heading. */
const MAX_NODES = 40;

/** Class on every injected `<mark>`; styled with the prose rules in `main.css`. */
const MARK_CLASS = "md-mark";

/**
 * Namespace for heading ids inside the pane. `MarkdownRenderer` stamps every
 * heading with an `id` (slugifying one if the node lacks it), and the page
 * BEHIND the modal may already own that exact id — same page, in the common case
 * where you searched from the page you are reading. Prefixing keeps the document
 * free of duplicate ids; the `#` anchors those ids feed are inert here anyway,
 * because the pane sets `pointer-events: none`.
 */
const PREVIEW_ID_PREFIX = "search-preview-";

/**
 * Subtrees whose children are NOT prose: `pre` carries the fence as `code` and
 * its rangi markup as `highlighted` (both props, so a mark could only corrupt
 * them), and `html`/`_html` children are raw markup strings the renderer injects
 * with `innerHTML`. Their props still pass through untouched.
 */
const OPAQUE = new Set(["pre", "html", "_html"]);

function isHeadingTag(tag: string): boolean {
  return HEADING.test(tag);
}

/** Does this subtree contain the heading `anchor` names? */
function containsAnchor(node: MarkNode, anchor: string): boolean {
  if (!Array.isArray(node)) return false;
  const [tag, props] = node;
  if (typeof tag === "string" && isHeadingTag(tag) && (props as any)?.id === anchor) return true;
  return (node.slice(2) as MarkNode[]).some((child) => containsAnchor(child, anchor));
}

/**
 * The TOP-LEVEL node the pane should start at. A heading is normally a top-level
 * sibling, but one nested inside a block (a tab, a card) still resolves — to the
 * block that holds it, which is the smallest thing that can be rendered whole.
 */
export function nodeAnchorIndex(nodes: MarkNode[], anchor?: string): number {
  if (!anchor) return 0;
  const at = nodes.findIndex((node) => containsAnchor(node, anchor));
  return at === -1 ? 0 : at;
}

/** Split one text run into plain strings and `<mark>` elements. */
function markText(text: string, terms: string[]): MarkNode[] {
  const ranges = matchRanges(text, terms);
  if (!ranges.length) return [text];
  return toSegments(text, ranges).map((seg) =>
    seg.mark ? (["mark", { class: MARK_CLASS }, seg.text] as MarkElement) : seg.text,
  );
}

function prepareChildren(children: MarkNode[], terms: string[]): MarkNode[] {
  const out: MarkNode[] = [];
  for (const child of children) {
    if (typeof child === "string") out.push(...markText(child, terms));
    else out.push(prepareNode(child, terms));
  }
  return out;
}

/** Copy a node for the pane: marked, id-namespaced, and free of heavy embeds. */
function prepareNode(node: MarkNode, terms: string[]): MarkNode {
  if (!Array.isArray(node)) return node;
  const [tag, rawProps, ...children] = node;
  // `[null, …]` is an AST comment; the renderer drops it.
  if (typeof tag !== "string") return node;

  // A diagram would pull the whole mermaid chunk into the palette to draw
  // something nobody can interact with. Its source reads fine as a fence.
  if (tag === "mermaid") {
    return ["pre", { code: (rawProps as any)?.code ?? "", language: "mermaid" }];
  }

  // Never mutate the cached page AST — this tree is rebuilt, not edited.
  const props: Record<string, any> = { ...(rawProps as Record<string, any>) };
  if (isHeadingTag(tag)) {
    props.id = PREVIEW_ID_PREFIX + (props.id || slugify(textContent(node)));
  }
  return OPAQUE.has(tag)
    ? [tag, props, ...(children as MarkNode[])]
    : [tag, props, ...prepareChildren(children as MarkNode[], terms)];
}

/**
 * The nodes to hand `MarkdownRenderer`: the page from its matched heading on,
 * bounded, with every query term wrapped in a `<mark>`.
 */
export function previewNodes(
  body: MarkNode[] | undefined | null,
  anchor: string | undefined,
  terms: string[],
  max: number = MAX_NODES,
): MarkNode[] {
  const nodes = body || [];
  if (!nodes.length) return [];
  const start = nodeAnchorIndex(nodes, anchor);
  return prepareChildren(nodes.slice(start, start + max), terms);
}
