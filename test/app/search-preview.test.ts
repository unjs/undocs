import { describe, it, expect, beforeAll } from "vitest";
import * as md4x from "md4x/wasm";
import { transformBody } from "../../src/server/content/transforms.ts";
import { highlightBody } from "../../src/server/content/highlight.ts";
import {
  anchorIndex,
  nodeAnchorIndex,
  previewBlocks,
  previewNodes,
} from "../../src/app/utils/search-preview.ts";
import { highlight, snippet } from "../../src/app/utils/search-highlight.ts";
import type { MarkNode } from "../../src/server/content/types.ts";

/**
 * The search palette's preview pane reads a page's REAL body, so these parse
 * markdown the way the builder does rather than hand-writing an AST: what the
 * pane must survive is md4x's node shapes (a heading carrying its anchor, a
 * fence carrying `code`, a nested list, a lifted `_html` node), not ours.
 */
beforeAll(async () => {
  await md4x.init();
});

// The builder highlights after transforming, so a `pre` reaching the preview
// already carries `code`/`highlighted` props. Mirror that — it is what makes the
// pane's fences look like the page's.
function parse(md: string): MarkNode[] {
  const body = transformBody(md4x.parseAST(md).nodes as MarkNode[]);
  highlightBody(body);
  return body;
}

const PAGE = `
# Install

Get started with **undocs** in a minute.

## Options

Pass \`--dir\` to point at another folder.

\`\`\`bash
npx undocs dev docs
\`\`\`

- first option
- second option, with a [link](/guide)

> A quoted aside.

### Nested heading {#custom}

| Flag | Meaning |
| ---- | ------- |
| --dir | docs folder |

## After

Content past the matched section.
`;

describe("previewBlocks", () => {
  it("flattens a page into readable text blocks", () => {
    const blocks = previewBlocks(parse(PAGE));
    const kinds = blocks.map((b) => b.kind);
    expect(kinds).toContain("heading");
    expect(kinds).toContain("text");
    expect(kinds).toContain("code");
    expect(kinds).toContain("list");
    expect(kinds).toContain("quote");

    // Inline markup contributes its text, not its tags.
    expect(blocks.find((b) => b.kind === "text" && b.text.includes("undocs"))?.text).toBe(
      "Get started with undocs in a minute.",
    );
  });

  it("keeps the fence's source and language, not its highlighted markup", () => {
    const code = previewBlocks(parse(PAGE)).find((b) => b.kind === "code");
    expect(code?.text).toBe("npx undocs dev docs");
    expect(code?.lang).toBe("bash");
    expect(code?.text).not.toContain("<span");
  });

  it("carries md4x's heading anchors so a hit can be located", () => {
    const blocks = previewBlocks(parse(PAGE));
    const headings = blocks.filter((b) => b.kind === "heading");
    expect(headings.map((h) => h.id)).toEqual(["install", "options", "custom", "after"]);
    expect(headings.map((h) => h.depth)).toEqual([1, 2, 3, 2]);
  });

  it("emits nothing for a node with no readable text", () => {
    expect(previewBlocks(parse("![alt](/x.png)\n\n---\n"))).toEqual([]);
  });

  it("flattens a table row into one line", () => {
    const row = previewBlocks(parse(PAGE)).find((b) => b.kind === "row");
    expect(row?.text).toBe("--dir  ·  docs folder");
  });
});

describe("anchorIndex", () => {
  it("starts at the matched heading and reads on past its section", () => {
    const blocks = previewBlocks(parse(PAGE));
    const at = anchorIndex(blocks, "options");
    expect(blocks[at]).toMatchObject({ kind: "heading", id: "options" });
    // The pane deliberately does not stop at the section boundary.
    expect(blocks.slice(at).some((b) => b.kind === "heading" && b.id === "after")).toBe(true);
  });

  it("falls back to the top of the page", () => {
    const blocks = previewBlocks(parse(PAGE));
    expect(anchorIndex(blocks, undefined)).toBe(0);
    expect(anchorIndex(blocks, "no-such-anchor")).toBe(0);
  });
});

describe("highlight", () => {
  it("marks the whole word a prefix term matched", () => {
    expect(highlight("Install the CLI", ["instal"])).toEqual([
      { text: "Install", mark: true },
      { text: " the CLI", mark: false },
    ]);
  });

  it("does not mark mid-word", () => {
    expect(highlight("reinstall", ["install"])).toEqual([{ text: "reinstall", mark: false }]);
  });

  it("returns one unmarked run when nothing matched", () => {
    expect(highlight("plain text", ["zzz"])).toEqual([{ text: "plain text", mark: false }]);
  });
});

describe("snippet", () => {
  it("elides both sides of a window around the first match", () => {
    const text = `${"a ".repeat(80)}needle${" b".repeat(80)}`;
    const segments = snippet(text, ["needle"]);
    expect(segments[0].text).toBe("…");
    expect(segments.at(-1)!.text).toBe("…");
    expect(segments.some((s) => s.mark && s.text === "needle")).toBe(true);
  });

  it("is empty for blank content", () => {
    expect(snippet("   ", ["x"])).toEqual([]);
  });
});

/** Flatten a prepared tree back to text, so assertions read as prose. */
function text(nodes: MarkNode[]): string {
  return nodes
    .map((n) =>
      typeof n === "string" ? n : Array.isArray(n) ? text(n.slice(2) as MarkNode[]) : "",
    )
    .join("");
}

/** Every element in a prepared tree, depth-first. */
function elements(nodes: MarkNode[], out: MarkNode[] = []): MarkNode[] {
  for (const n of nodes) {
    if (!Array.isArray(n)) continue;
    out.push(n);
    elements(n.slice(2) as MarkNode[], out);
  }
  return out;
}

describe("previewNodes", () => {
  it("keeps the page's own AST — highlighted fences and all", () => {
    const nodes = previewNodes(parse(PAGE), "options", []);
    const pre = elements(nodes).find((n) => (n as any)[0] === "pre") as any;
    expect(pre[1].code).toBe("npx undocs dev docs");
    expect(pre[1].highlighted).toContain("shj-");
    expect(pre[1].language).toBe("bash");
  });

  it("wraps matched terms in a <mark>, and only in prose", () => {
    const nodes = previewNodes(parse(PAGE), "options", ["folder"]);
    const marks = elements(nodes).filter((n) => (n as any)[0] === "mark");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((m) => (m as any)[1].class === "md-mark")).toBe(true);
    // The text is preserved exactly; marking only re-splits it.
    expect(text(nodes)).toContain("Pass --dir to point at another folder.");
  });

  it("leaves an opaque subtree's children alone", () => {
    // `pre` children are the raw fence; its rangi markup lives in props.
    const nodes = previewNodes(parse(PAGE), "options", ["undocs"]);
    const pre = elements(nodes).find((n) => (n as any)[0] === "pre") as any;
    expect(elements(pre.slice(2)).some((n) => (n as any)[0] === "mark")).toBe(false);
  });

  it("namespaces every heading id so the page behind the modal cannot collide", () => {
    const headings = elements(previewNodes(parse(PAGE), undefined, [])).filter((n) =>
      /^h[1-6]$/.test((n as any)[0]),
    );
    expect(headings.map((h) => (h as any)[1].id)).toEqual([
      "search-preview-install",
      "search-preview-options",
      "search-preview-custom",
      "search-preview-after",
    ]);
  });

  it("does not mutate the cached page AST", () => {
    const body = parse(PAGE);
    const snapshot = JSON.stringify(body);
    previewNodes(body, "options", ["folder", "undocs"]);
    expect(JSON.stringify(body)).toBe(snapshot);
  });

  it("swaps a mermaid diagram for its source", () => {
    const nodes = previewNodes(parse("```mermaid\ngraph TD;\nA-->B\n```\n"), undefined, []);
    expect(nodes[0]).toEqual(["pre", { code: "graph TD;\nA-->B\n", language: "mermaid" }]);
  });

  it("reads on past the matched section, bounded by `max`", () => {
    const nodes = previewNodes(parse(PAGE), "options", [], 4);
    expect(nodes).toHaveLength(4);
    expect((nodes[0] as any)[1].id).toBe("search-preview-options");
  });

  it("is empty for a page with no body", () => {
    expect(previewNodes(null, "options", [])).toEqual([]);
  });
});

describe("nodeAnchorIndex", () => {
  it("finds the top-level node carrying the anchor", () => {
    const body = parse(PAGE);
    const at = nodeAnchorIndex(body, "custom");
    expect((body[at] as any)[0]).toBe("h3");
  });

  it("falls back to the top of the page", () => {
    const body = parse(PAGE);
    expect(nodeAnchorIndex(body, undefined)).toBe(0);
    expect(nodeAnchorIndex(body, "no-such-anchor")).toBe(0);
  });
});
