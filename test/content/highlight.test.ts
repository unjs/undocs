import { describe, it, expect } from "vitest";
import { highlightCode, highlightBody } from "../../src/server/content/highlight";
import type { MarkNode, MarkElement } from "../../src/server/content/types";

describe("highlightCode", () => {
  it("highlights a supported language into semantic token markup", async () => {
    const html = highlightCode("const a = 1", "ts");
    expect(html).toContain(`<pre class="code-hl code-hl-lang-ts">`);
    // `classes: true` — tokens carry a class, never an inline colour. The
    // palette lives in `assets/main.css` (see theme.test.ts for the drift guard).
    expect(html).toContain(`<span class="shj-kwd">const</span>`);
    expect(html).not.toContain("<span style=");
    expect(html).not.toContain("light-dark(");
  });

  it("resolves rangi's own aliases to the canonical grammar name", async () => {
    expect(highlightCode("const a = 1", "javascript")).toContain("code-hl-lang-js");
    expect(highlightCode("a: 1", "yml")).toContain("code-hl-lang-yaml");
    expect(highlightCode("echo hi", "sh")).toContain("code-hl-lang-bash");
    expect(highlightCode("x = 1", "python")).toContain("code-hl-lang-py");
  });

  it("resolves the aliases rangi lacks", async () => {
    expect(highlightCode("echo hi", "shellscript")).toContain("code-hl-lang-bash");
    expect(highlightCode("a { b: 1 }", "sass")).toContain("code-hl-lang-scss");
    expect(highlightCode("A_KEY=1", "dotenv")).toContain("code-hl-lang-ini");
    expect(highlightCode("int x;", "c++")).toContain("code-hl-lang-cpp");
  });

  it("highlights the languages that used to need a local grammar", async () => {
    // rangi 2.1 ships jsx/tsx and aliases jsonc/json5 onto its json grammar.
    expect(highlightCode("const A = () => <div x={1} />", "jsx")).toContain("code-hl-lang-jsx");
    expect(highlightCode("const A = (): JSX.Element => <div />", "tsx")).toContain(
      "code-hl-lang-tsx",
    );
    expect(highlightCode('{ /* c */ "a": 1 }', "jsonc")).toContain(`<span class="shj-cmnt">`);
  });

  it("no longer swallows a yaml comment after an HTML comment", async () => {
    // The bug the local `yaml` fork existed for, fixed upstream in rangi 2.1.
    const html = highlightCode('<!-- x -->\n\n# a comment\n\nname: "v"', "yaml");
    expect(html).toContain(`<span class="shj-cmnt"># a comment</span>`);
  });

  it("escapes markup inside highlighted output", async () => {
    const html = highlightCode("// a < b & c", "js");
    expect(html).not.toContain("a < b");
    expect(html).toContain("&lt;");
  });

  it("falls back to an escaped <pre> for plain text", async () => {
    const html = highlightCode("a < b & c", "text");
    expect(html).toBe("<pre><code>a &lt; b &amp; c</code></pre>");
  });

  it("falls back to escaped <pre> for an unknown language", async () => {
    const html = highlightCode("x", "not-a-real-lang");
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
