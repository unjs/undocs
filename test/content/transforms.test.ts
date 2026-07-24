import { describe, it, expect, beforeAll } from "vitest";
import * as md4x from "md4x/wasm";
import { transformBody } from "../../src/server/content/transforms";
import type { MarkElement, MarkNode } from "../../src/server/content/types";

// `transformBody` calls into md4x when lifting raw inline HTML, so the wasm
// module must be initialized first.
beforeAll(async () => {
  await md4x.init();
});

describe("transformBody: mermaid", () => {
  it("rewrites a mermaid code fence into a <mermaid> node", () => {
    const nodes: MarkNode[] = [["pre", { language: "mermaid" }, ["code", {}, "graph TD;\nA-->B"]]];
    const [node] = transformBody(nodes) as MarkElement[];
    expect(node[0]).toBe("mermaid");
    expect(node[1].code).toBe("graph TD;\nA-->B");
    expect(node.length).toBe(2); // children spliced away
  });
});

describe("transformBody: steps", () => {
  it("converts a multi-item ordered list into a steps block", () => {
    const nodes: MarkNode[] = [["ol", {}, ["li", {}, "First"], ["li", {}, "Second"]]];
    const [node] = transformBody(nodes) as MarkElement[];
    expect(node[0]).toBe("steps");
    expect(node[1].level).toBe("4");
    expect((node[2] as MarkElement)[0]).toBe("h4");
    expect((node[2] as MarkElement)[2]).toBe("First");
  });

  it("leaves a single-item ordered list alone", () => {
    const nodes: MarkNode[] = [["ol", {}, ["li", {}, "Only"]]];
    const [node] = transformBody(nodes) as MarkElement[];
    expect(node[0]).toBe("ol");
  });
});

describe("transformBody: alerts", () => {
  it("lowercases the alert type", () => {
    const nodes: MarkNode[] = [["alert", { type: "NOTE" }, "heads up"]];
    const [node] = transformBody(nodes) as MarkElement[];
    expect(node[1].type).toBe("note");
  });
});

describe("transformBody: relative link resolution", () => {
  const linkHref = (nodes: MarkNode[], rel: string): string => {
    const [p] = transformBody(nodes, rel) as MarkElement[];
    return (p[2] as MarkElement)[1].href;
  };
  const para = (href: string): MarkNode[] => [["p", {}, ["a", { href }, "x"]]];

  it("resolves a sibling .md link to a route path, stripping prefix + extension", () => {
    expect(linkHref(para("./02.conventions-and-terminology.md"), "2.spec/12.pack-format.md")).toBe(
      "/spec/conventions-and-terminology",
    );
  });

  it("resolves a parent-directory link and preserves the hash", () => {
    expect(linkHref(para("../1.guide/1.index.md#usage"), "2.spec/12.pack-format.md")).toBe(
      "/guide#usage",
    );
  });

  it("leaves external, root-absolute, and anchor-only links untouched", () => {
    expect(linkHref(para("https://x.com/a.md"), "a.md")).toBe("https://x.com/a.md");
    expect(linkHref(para("/spec/foo"), "a.md")).toBe("/spec/foo");
    expect(linkHref(para("#section"), "a.md")).toBe("#section");
  });

  it("leaves non-content relative links (images/assets) untouched", () => {
    expect(linkHref(para("./diagram.png"), "2.spec/12.pack-format.md")).toBe("./diagram.png");
  });

  it("is a no-op when no rel is supplied", () => {
    expect(linkHref(para("./02.foo.md"), undefined as unknown as string)).toBe("./02.foo.md");
  });
});

describe("transformBody: code groups", () => {
  const named = (filename: string, code: string): MarkNode => [
    "pre",
    { filename },
    ["code", {}, code],
  ];

  it("merges consecutive named code blocks into a code-group", () => {
    const nodes: MarkNode[] = [named("a.ts", "1"), named("b.ts", "2")];
    const out = transformBody(nodes) as MarkElement[];
    expect(out).toHaveLength(1);
    expect(out[0][0]).toBe("code-group");
    expect(out[0].slice(2)).toHaveLength(2);
  });

  it("does not group a lone named code block", () => {
    const nodes: MarkNode[] = [named("a.ts", "1"), ["p", {}, "prose"]];
    const out = transformBody(nodes) as MarkElement[];
    expect(out[0][0]).toBe("pre");
  });
});

describe("transformBody: raw html lifting", () => {
  it("wraps a string containing a real tag into an _html node", () => {
    const nodes: MarkNode[] = [["p", {}, "a <br> b"]];
    const [p] = transformBody(nodes) as MarkElement[];
    const child = p[2] as MarkElement;
    expect(child[0]).toBe("_html");
    expect(String(child[2])).toContain("<br>");
  });

  it("passes an html_block through verbatim", () => {
    const nodes: MarkNode[] = [["html_block", {}, "<div>x</div>"]];
    const [node] = transformBody(nodes) as MarkElement[];
    expect(node[0]).toBe("_html");
    expect(node[1].block).toBe(true);
    expect(node[2]).toBe("<div>x</div>");
  });
});

describe("transformBody: unwrap block paragraphs", () => {
  it("unwraps a paragraph wrapping a lone block component (`:pm-x{}`)", () => {
    // md4x wraps an inline component sitting alone on its line in a paragraph;
    // the component renders a <div>, which is invalid inside <p> and breaks
    // hydration — so it must be promoted to the parent level.
    const nodes: MarkNode[] = [["p", {}, ["pm-x", { command: "giget x" }]]];
    const [node] = transformBody(nodes) as MarkElement[];
    expect(node[0]).toBe("pm-x");
    expect((node[1] as any).command).toBe("giget x");
  });

  it("drops surrounding whitespace when unwrapping", () => {
    const nodes: MarkNode[] = [["p", {}, "\n", ["pm-run", { script: "dev" }], "\n"]];
    const out = transformBody(nodes) as MarkElement[];
    expect(out.length).toBe(1);
    expect(out[0][0]).toBe("pm-run");
  });

  it("keeps a paragraph that has real text alongside a component", () => {
    const nodes: MarkNode[] = [["p", {}, "See ", ["pm-x", { command: "x" }]]];
    const [node] = transformBody(nodes) as MarkElement[];
    expect(node[0]).toBe("p");
  });

  it("leaves an inline element (phrasing) wrapped in its paragraph", () => {
    const nodes: MarkNode[] = [["p", {}, ["a", { href: "/x" }, "link"]]];
    const [node] = transformBody(nodes) as MarkElement[];
    expect(node[0]).toBe("p");
  });

  it("unwraps a block component nested inside a container block", () => {
    const nodes: MarkNode[] = [["alert", { type: "note" }, ["p", {}, ["pm-x", { command: "x" }]]]];
    const [node] = transformBody(nodes) as MarkElement[];
    expect(node[0]).toBe("alert");
    expect((node[2] as MarkElement)[0]).toBe("pm-x");
  });
});
