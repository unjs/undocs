// Tests: test/content/utils.test.ts
import type { MarkNode } from "./types.ts";

export function stripPrefix(seg: string): string {
  return seg.replace(/^\d+\./, "");
}

/**
 * The file names that stand for a directory itself rather than a page inside it.
 *
 * `README` is an alias for `index`, because it is the file a repository host
 * renders for a directory — so a docs set that already reads well when browsed
 * on GitHub builds without being renamed. Matched case-insensitively: `README`,
 * `readme` and `ReadMe` are all in the wild, and on a case-insensitive
 * filesystem they are the same file anyway.
 */
const INDEX_NAMES = new Set(["index", "readme"]);

/** The file's own name, without its numeric prefix, directories or extension. */
function baseName(rel: string): string {
  return stripPrefix(rel.split("/").pop() ?? "").replace(/\.(md|yml)$/i, "");
}

/** Does this file stand for its directory (`index.md`, `README.md`, `1.index.md`)? */
export function isIndexFile(rel: string): boolean {
  return INDEX_NAMES.has(baseName(rel).toLowerCase());
}

/** Specifically the `README` spelling — the alias, not the canonical name. */
export function isReadmeFile(rel: string): boolean {
  return baseName(rel).toLowerCase() === "readme";
}

/** Derive a route path from a source-relative file path. */
export function toRoutePath(rel: string): string {
  const segs = rel
    .replace(/\.(md|yml)$/, "")
    .split("/")
    .map(stripPrefix);
  if (INDEX_NAMES.has((segs[segs.length - 1] ?? "").toLowerCase())) segs.pop();
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
