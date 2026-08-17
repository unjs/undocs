import type { MarkNode } from "./types.ts";

export function stripPrefix(seg: string): string {
  return seg.replace(/^\d+\./, "");
}

// `README` aliases `index` case-insensitively for repository-browsable docs.

const INDEX_NAMES = new Set(["index", "readme"]);

function baseName(rel: string): string {
  return stripPrefix(rel.split("/").pop() ?? "").replace(/\.(md|yml)$/i, "");
}

export function isIndexFile(rel: string): boolean {
  return INDEX_NAMES.has(baseName(rel).toLowerCase());
}

export function isReadmeFile(rel: string): boolean {
  return baseName(rel).toLowerCase() === "readme";
}

export function toRoutePath(rel: string): string {
  const segs = rel
    .replace(/\.(md|yml)$/, "")
    .split("/")
    .map(stripPrefix);
  if (INDEX_NAMES.has((segs[segs.length - 1] ?? "").toLowerCase())) segs.pop();
  const joined = "/" + segs.join("/");
  return joined === "/" ? "/" : joined.replace(/\/$/, "");
}

// Include each segment's name after its numeric prefix to break ties independently
// of filesystem order without outranking the number.

export function orderKey(rel: string): string {
  return rel
    .split("/")
    .map((s) => {
      const m = s.match(/^(\d+)\./);
      return m ? m[1].padStart(6, "0") + "." + s.slice(m[0].length) : "999999" + s;
    })
    .join("/");
}

export function textContent(node: MarkNode | undefined | null): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  // AST comments carry no readable text.
  if (node[0] === null) return "";
  // Inline raw HTML contributes wrapped prose but not tags; block HTML contributes
  // neither. This keeps TOC text aligned with md4x's heading IDs.
  if (node[0] === "html" || node[0] === "_html") {
    if (node[1]?.block || typeof node[2] !== "string") return "";
    return node[2].replaceAll(/<[^>]*>/g, "");
  }
  return (node.slice(2) as MarkNode[]).map(textContent).join("");
}

/**
 * Unicode fallback slugger for bodies not parsed by md4x. Keep `_` for existing
 * anchors; parser-assigned page IDs, including uniqueness, remain authoritative.
 */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}_\s-]/gu, "")
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
