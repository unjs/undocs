import { describe, it, expect, beforeAll } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import * as md4x from "md4x/wasm";
import { transformBody } from "../../src/server/content/transforms.ts";
import MarkdownRenderer from "../../src/app/content/MarkdownRenderer.ts";
import type { MarkNode } from "../../src/server/content/types.ts";

beforeAll(async () => {
  await md4x.init();
});

const parse = (src: string) => transformBody(md4x.parseAST(src).nodes as MarkNode[]);

const render = (src: string) =>
  renderToString(createSSRApp({ render: () => h(MarkdownRenderer, { body: parse(src) }) }));

describe("transformBody: inline :br", () => {
  it("splits a bare `:br` out of text, including in indented block content", () => {
    const nodes = parse("::field{name=a}\n    One. :br\n    Two :br :br\n    Three.:br\n::");
    expect(nodes[0]).toEqual([
      "field",
      { name: "a" },
      ["p", {}, "One. ", ["br", {}], "\nTwo ", ["br", {}], " ", ["br", {}], "\nThree.", ["br", {}]],
    ]);
  });

  it("leaves code, glued words and longer names alone", () => {
    expect(parse("`:br` a:br :brand")).toEqual([["p", {}, ["code", {}, ":br"], " a:br :brand"]]);
  });
});

describe("::field / ::field-group", () => {
  it("renders a group of fields with name, type, required and a :br in the body", async () => {
    const html = await render(`::field-group
  ::field{name="base" type="string | string[]" required}
    Storage base. :br
    Defaults to \`/cache\`.
  ::
  ::field{name="maxAge" type="number" description="Seconds."}
  ::
::`);
    expect(html).toContain('class="field-group');
    expect(html.match(/class="field /g)).toHaveLength(2);
    expect(html).toContain(">base</span>");
    expect(html).toContain(">string | string[]</span>");
    expect(html).toContain(">required</span>");
    expect(html).toMatch(/Storage base\. <br>\s*Defaults to <code>\/cache<\/code>\./);
    expect(html).toContain(">maxAge</span>");
    expect(html).toContain(">number</span>");
    expect(html).toContain("Seconds.");
    // Only the first field is required, and nothing leaks as a raw attribute.
    expect(html.match(/>required</g)).toHaveLength(1);
    expect(html).not.toMatch(/ (name|type)="/);
    expect(html).not.toContain(":br");
  });
});
