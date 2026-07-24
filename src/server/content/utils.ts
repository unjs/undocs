// Tests: test/content/utils.test.ts
import type { MarkNode } from "./types";

export function stripPrefix(seg: string): string {
  return seg.replace(/^\d+\./, "");
}

/** Derive a route path from a source-relative file path. */
export function toRoutePath(rel: string): string {
  const segs = rel
    .replace(/\.(md|yml)$/, "")
    .split("/")
    .map(stripPrefix);
  if (segs[segs.length - 1] === "index") segs.pop();
  const joined = "/" + segs.join("/");
  return joined === "/" ? "/" : joined.replace(/\/$/, "");
}

/** Stable sort key preserving numeric ordering per path segment. */
export function orderKey(rel: string): string {
  return rel
    .split("/")
    .map((s) => {
      const m = s.match(/^(\d+)\./);
      return m ? m[1].padStart(6, "0") : "999999" + s;
    })
    .join("/");
}

export function textContent(node: MarkNode | undefined | null): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  // HTML comments (`[null, {}, "..."]`, e.g. automd markers) carry no readable
  // text — skip them so they don't pollute titles/search. Raw HTML (`_html`)
  // falls through to the generic walk, yielding its markup verbatim; callers
  // that need clean prose (search) run it through `md4x.renderToText`.
  if (node[0] === null) return "";
  return (node.slice(2) as MarkNode[]).map(textContent).join("");
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function titleCase(s: string): string {
  return s
    .replace(/[-_]/g, " ")
    .replace(/(^|\s)(\w)/g, (_, a, b) => a + b.toUpperCase())
    .replace(/\bApi\b/g, "API");
}
