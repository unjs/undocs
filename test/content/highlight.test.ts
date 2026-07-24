import { describe, it, expect } from "vitest";
import { highlightCode, highlightBody } from "../../src/server/content/highlight";
import type { MarkNode, MarkElement } from "../../src/server/content/types";

describe("highlightCode", () => {
  it("highlights a loaded language into dual-theme markup", async () => {
    const html = await highlightCode("const a = 1", "ts");
    expect(html).toContain("<pre");
    // dual-theme output carries per-token CSS variables
    expect(html).toContain("--shiki-light");
    expect(html).toContain("--shiki-dark");
  });

  it("falls back to an escaped <pre> for plain text", async () => {
    const html = await highlightCode("a < b & c", "text");
    expect(html).toBe("<pre><code>a &lt; b &amp; c</code></pre>");
  });

  it("falls back to escaped <pre> for an unknown language", async () => {
    const html = await highlightCode("x", "not-a-real-lang");
    expect(html).toBe("<pre><code>x</code></pre>");
  });
});

describe("highlightBody", () => {
  it("annotates pre nodes with code + highlighted html and returns the count", async () => {
    const nodes: MarkNode[] = [
      ["p", {}, "intro"],
      ["pre", { language: "ts" }, ["code", {}, "const a = 1\n"]],
    ];
    const count = await highlightBody(nodes);
    expect(count).toBe(1);
    const pre = nodes[1] as MarkElement;
    expect(pre[1].code).toBe("const a = 1");
    expect(pre[1].highlighted).toContain("<pre");
  });

  it("returns 0 when there are no code blocks", async () => {
    const count = await highlightBody([["p", {}, "no code here"]]);
    expect(count).toBe(0);
  });
});
