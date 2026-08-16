import { describe, it, expect, beforeAll } from "vitest";
import * as md4x from "md4x/wasm";
import { transformBody } from "../../src/server/content/transforms.ts";
import type { MarkElement, MarkNode } from "../../src/server/content/types.ts";

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
    expect(node.slice(2)).toEqual([
      ["div", { class: "step" }, "First"],
      ["div", { class: "step" }, "Second"],
    ]);
  });

  it("keeps each item's content verbatim, without synthesizing a heading", () => {
    const nodes: MarkNode[] = [
      [
        "ol",
        {},
        ["li", {}, ["p", {}, "First"], ["note", {}, ["p", {}, "hint"]], ["p", {}, "body"]],
        ["li", {}, ["p", {}, "Second"]],
      ],
    ];
    const [node] = transformBody(nodes) as MarkElement[];
    expect(node.slice(2)).toEqual([
      [
        "div",
        { class: "step" },
        ["p", {}, "First"],
        ["note", {}, ["p", {}, "hint"]],
        ["p", {}, "body"],
      ],
      ["div", { class: "step" }, ["p", {}, "Second"]],
    ]);
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

  // md4x marks `<https://…>` with `autolink: true`, and every prop on an `a`
  // node is spread onto the anchor — so left in place it renders as a stray
  // `autolink="true"` attribute. Dropped with or without a `rel`.
  it("drops md4x's autolink marker", () => {
    const link = (rel?: string) =>
      (
        (
          transformBody(md4x.parseAST("<https://e.com/>\n").nodes, rel) as MarkElement[]
        )[0][2] as MarkElement
      )[1];
    expect(link("a.md")).toEqual({ href: "https://e.com/" });
    expect(link()).toEqual({ href: "https://e.com/" });
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
  // md4x tags raw HTML as its own node: `["html", { block: true }, src]` for a
  // fence, `["html", {}, "<b>"]` for one inline TAG. The inline shape is the
  // sharp edge — a pair is two nodes with the content between them.
  const html = (source: string, block = false): MarkNode =>
    ["html", block ? { block: true } : {}, source] as MarkElement;

  it("passes a block html node through verbatim", () => {
    const nodes: MarkNode[] = [html("<div>x</div>\n", true)];
    const [node] = transformBody(nodes) as MarkElement[];
    expect(node[0]).toBe("_html");
    expect(node[1].block).toBe(true);
    expect(node[2]).toBe("<div>x</div>\n");
  });

  it("leaves a plain `<` in text alone (md4x no longer calls it a tag)", () => {
    const nodes: MarkNode[] = [["p", {}, "3 < 5 and a > b"]];
    const [p] = transformBody(nodes) as MarkElement[];
    expect(p[2]).toBe("3 < 5 and a > b");
  });

  it("merges a matched inline pair and its text into one _html node", () => {
    const nodes: MarkNode[] = [["p", {}, "press ", html("<kbd>"), "Ctrl", html("</kbd>"), " now"]];
    const [p] = transformBody(nodes) as MarkElement[];
    expect(p.slice(2)).toEqual(["press ", ["_html", {}, "<kbd>Ctrl</kbd>"], " now"]);
  });

  it("counts nesting, so the merge ends at the OUTER closing tag", () => {
    const nodes: MarkNode[] = [
      ["p", {}, html("<b>"), "x ", html("<i>"), "y", html("</i>"), html("</b>")],
    ];
    const [p] = transformBody(nodes) as MarkElement[];
    expect(p.slice(2)).toEqual([["_html", {}, "<b>x <i>y</i></b>"]]);
  });

  // The text md4x hands over is already plain (`&copy;` arrived as `©`), so
  // every one of the three markup characters has to be escaped on its way back
  // into HTML source — `&` included, or the ampersand opens an entity.
  it("escapes `<`, `>` and `&` in the text it merges", () => {
    const nodes: MarkNode[] = [["p", {}, html("<b>"), "a < b & c", html("</b>")]];
    const [p] = transformBody(nodes) as MarkElement[];
    expect((p[2] as MarkElement)[2]).toBe("<b>a &lt; b &amp; c</b>");
  });

  it("keeps a void tag standalone rather than swallowing what follows", () => {
    const nodes: MarkNode[] = [["p", {}, "a", html("<br>"), "b", html("<br>"), "c"]];
    const [p] = transformBody(nodes) as MarkElement[];
    expect(p.slice(2)).toEqual(["a", ["_html", {}, "<br>"], "b", ["_html", {}, "<br>"], "c"]);
  });

  // A run holding a real element cannot be serialized back to HTML source here,
  // so its fragments stay separate — the same (imperfect) rendering they got
  // before md4x could tell a tag from a literal `<`.
  it("does not merge across a run containing a real element", () => {
    const nodes: MarkNode[] = [["p", {}, html("<b>"), ["strong", {}, "x"], html("</b>")]];
    const [p] = transformBody(nodes) as MarkElement[];
    expect((p[2] as MarkElement)[0]).toBe("_html");
    expect((p[3] as MarkElement)[0]).toBe("strong");
    expect((p[4] as MarkElement)[0]).toBe("_html");
  });

  it("lifts an unmatched inline tag on its own", () => {
    const nodes: MarkNode[] = [["p", {}, "a ", html("<b>"), "x"]];
    const [p] = transformBody(nodes) as MarkElement[];
    expect(p.slice(2)).toEqual(["a ", ["_html", {}, "<b>"], "x"]);
  });

  it("keeps a paragraph of nothing but inline tags a paragraph", () => {
    const nodes: MarkNode[] = [["p", {}, html("<span>"), html("</span>")]];
    const [p] = transformBody(nodes) as MarkElement[];
    expect(p[0]).toBe("p");
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

describe("transformBody: unwrap slot paragraphs", () => {
  const slot = (...children: MarkNode[]): MarkNode[] => [
    ["card", {}, ["template", { name: "description" }, ...children]],
  ];
  const slotOf = (nodes: MarkNode[]): MarkElement =>
    (transformBody(nodes) as MarkElement[])[0][2] as MarkElement;

  it("unwraps a slot filled with a single paragraph", () => {
    // A component renders a named slot inside an element of its own choosing —
    // often a `<p>`. Nested paragraphs are invalid and break hydration.
    expect(slotOf(slot(["p", {}, "Card description."])).slice(2)).toEqual(["Card description."]);
  });

  it("keeps the paragraph's inline children intact", () => {
    const out = slotOf(slot(["p", {}, "See ", ["a", { href: "/x" }, "docs"]]));
    expect(out.slice(2)).toEqual(["See ", ["a", { href: "/x" }, "docs"]]);
  });

  it("leaves a slot holding two paragraphs alone", () => {
    const out = slotOf(slot(["p", {}, "One"], ["p", {}, "Two"]));
    expect(out.slice(2)).toEqual([
      ["p", {}, "One"],
      ["p", {}, "Two"],
    ]);
  });

  it("leaves a slot holding block content alone", () => {
    const out = slotOf(slot(["ul", {}, ["li", {}, "One"]]));
    expect((out[2] as MarkElement)[0]).toBe("ul");
  });

  it("keeps a paragraph that carries props", () => {
    const out = slotOf(slot(["p", { class: "text-lg" }, "Loud"]));
    expect((out[2] as MarkElement)[0]).toBe("p");
  });

  it("ignores whitespace around the paragraph", () => {
    const out = slotOf(slot("\n", ["p", {}, "Text"], "\n"));
    expect(out.slice(2).filter((c) => typeof c !== "string" || c.trim())).toEqual(["Text"]);
  });

  it("unwraps a slot on a component nested in another component's slot", () => {
    const nodes: MarkNode[] = [
      [
        "landing-features",
        {},
        [
          "template",
          { name: "body" },
          ["feature-card", {}, ["template", { name: "title" }, ["p", {}, "Caching"]]],
        ],
      ],
    ];
    const [section] = transformBody(nodes) as MarkElement[];
    const card = (section[2] as MarkElement)[2] as MarkElement;
    expect((card[2] as MarkElement).slice(2)).toEqual(["Caching"]);
  });

  it("leaves a plain paragraph outside any slot alone", () => {
    const nodes: MarkNode[] = [["p", {}, "prose"]];
    expect((transformBody(nodes) as MarkElement[])[0][0]).toBe("p");
  });
});

// md4x resolves HTML entities in the AST it hands us (0.0.29+), so undocs holds
// no entity table of its own. These parse REAL markdown rather than a hand-built
// AST, because what is being guarded is that contract: `MarkdownRenderer` builds a
// Vue text vnode and Vue escapes it, so anything left as entity source reaches the
// reader as its own spelling. The three exceptions md4x makes are load-bearing
// here too, for reasons that outlive md4x's own choice.
describe("html entities: what md4x hands transformBody", () => {
  const parse = (md: string) => transformBody(md4x.parseAST(md).nodes) as MarkElement[];

  it("arrive resolved in text, and in a link's or image's destination", () => {
    const [p, link, image] = parse(
      "A &amp; B &copy; C\n\n" +
        "[l](/x?a=1&amp;b=2 't &copy;')\n\n" +
        "![a &amp; b](/i&amp;x.png)\n",
    );
    expect(p[2]).toBe("A & B © C");
    expect((link[2] as MarkElement)[1]).toEqual({ href: "/x?a=1&b=2", title: "t ©" });
    expect((image[2] as MarkElement)[1]).toEqual({ src: "/i&x.png", alt: "a & b" });
  });

  // CommonMark is explicit that a code span holds its characters verbatim, so
  // `&amp;` inside backticks really is the five characters the author typed.
  it("stay source inside code, span and fence alike", () => {
    const [p, pre] = parse("`a &amp; b`\n\n```html\n<div>&amp;</div>\n```\n");
    expect((p[2] as MarkElement)[2]).toBe("a &amp; b");
    expect((pre[2] as MarkElement)[2]).toBe("<div>&amp;</div>\n");
  });

  // A component prop is a literal attribute value the author typed, not markdown
  // text — so `title` on a component is untouched while the same `title` on a
  // markdown link is a destination md4x resolves.
  it("stay source in a component's props", () => {
    const [note] = parse('::note{title="a &amp; b"}\nx\n::\n');
    expect(note[1].title).toBe("a &amp; b");
  });

  // Raw HTML source reaches the DOM through `innerHTML`, which resolves entities
  // natively; resolving them first would resolve them twice.
  it("stay source in raw html, and are re-escaped in the text merged into it", () => {
    const [block, p] = parse("<div>&amp;copy;</div>\n\na <b>x &amp; y</b> b\n");
    expect(block[2]).toBe("<div>&amp;copy;</div>\n");
    // The text arrived as `x & y`, so the `&` is escaped on its way back into
    // markup — `innerHTML` renders the ampersand, not a second entity.
    expect((p[3] as MarkElement)[2]).toBe("<b>x &amp; y</b>");
  });
});
