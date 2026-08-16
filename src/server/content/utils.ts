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

/**
 * Stable sort key preserving numeric ordering per path segment.
 *
 * The NAME is part of the key, not just the number. Two siblings may carry the
 * same prefix — sections a docs set numbered independently (`1.guide/` beside
 * `1.api/`), or two files an author gave the same number — and a number-only key
 * makes those byte-identical. Identical keys leave the sort to glob/readdir
 * order, so the walk interleaves the two sections' pages ("Next" from `/guide`
 * landing on `/api`) and does so differently per filesystem. The name breaks the
 * tie deterministically, alphabetically, and — because it is appended per
 * segment — without ever outranking the number in front of it.
 */
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
  // HTML comments (`[null, {}, "..."]`, e.g. automd markers) carry no readable
  // text — skip them so they don't pollute titles/search.
  if (node[0] === null) return "";
  // Raw HTML, before (`html`) and after (`_html`) `liftRawHtml`. Its markup is
  // never text — a `<b>` in a heading is a tag, the same reading md4x's own
  // `meta.headings[].text` takes — but the PROSE an inline pair wraps is, and
  // `liftRawHtml` has by then merged that prose into the node's own source. So
  // an inline node is unwrapped by stripping its tags: without this a
  // `## Heading with <em>markup</em> in it` lost the word `markup` from its TOC
  // entry while md4x's id (`…-markup-…`) kept it. A BLOCK node is a `<div>`
  // header, a `<script>`, an embed — markup wholesale, and nothing a title or a
  // search snippet wants any part of.
  if (node[0] === "html" || node[0] === "_html") {
    if (node[1]?.block || typeof node[2] !== "string") return "";
    return node[2].replaceAll(/<[^>]*>/g, "");
  }
  return (node.slice(2) as MarkNode[]).map(textContent).join("");
}

/**
 * Turn a heading's text into an anchor slug.
 *
 * The strip is UNICODE (`\p{L}\p{N}` with the `u` flag), not `\w`. `\w` is
 * ASCII-only, so `## Установка` and `## 安装` stripped down to the empty string —
 * and an empty id is not just an ugly anchor: the renderer gates the heading's
 * `id` and its `#` deep-link on a non-empty slug, so the whole TOC of a
 * non-Latin docs set pointed at nothing. `## Émoji 🚀 heading` was the same bug
 * wearing a disguise (`moji-heading`). `_` is kept explicitly — it was inside
 * `\w`, and dropping it would silently move every existing `snake_case` anchor.
 *
 * Uniqueness is NOT this function's job, and neither is a page's real anchors:
 * md4x allocates those at parse time and stamps them on the heading node (see
 * `buildToc`). This is the fallback for a body that never came through the
 * builder — `MarkdownRenderer` rendering an ad-hoc node array — and the slug
 * `search.ts` falls back to for the same reason.
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
