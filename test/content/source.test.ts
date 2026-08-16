import { describe, it, expect } from "vitest";
import { rewriteSourceLinks } from "../../src/server/content/source.ts";

const rewrite = (source: string, baseDir = "1.guide") => rewriteSourceLinks(source, baseDir);

describe("rewriteSourceLinks", () => {
  it("resolves file-relative links to route paths", () => {
    expect(rewrite("1. [Getting started](./2.getting-started.md)")).toBe(
      "1. [Getting started](/guide/getting-started)",
    );
    expect(rewrite("[Home](../index.md)")).toBe("[Home](/)");
    expect(rewrite("[Section](2.usage.md)")).toBe("[Section](/guide/usage)");
  });

  it("resolves a root page's own directory", () => {
    expect(rewrite("[Guide](./1.guide/1.index.md)", ".")).toBe("[Guide](/guide)");
  });

  it("keeps the anchor and any link title", () => {
    expect(rewrite('[Setup](./2.usage.md#setup "How to use")')).toBe(
      '[Setup](/guide/usage#setup "How to use")',
    );
  });

  it("resolves a pointy-bracket destination in place", () => {
    expect(rewrite("[Usage](<./2.usage.md>)")).toBe("[Usage](</guide/usage>)");
  });

  it("resolves a link reference definition", () => {
    expect(rewrite('[usage]: ./2.usage.md "Usage"')).toBe('[usage]: /guide/usage "Usage"');
  });

  it("resolves every link on a line", () => {
    expect(rewrite("[a](./2.usage.md) and [b](../index.md)")).toBe("[a](/guide/usage) and [b](/)");
  });

  it("leaves external, absolute and anchor-only links alone", () => {
    const source = "[a](https://x.dev/y.md) [b](/guide/usage) [c](#setup) [d](mailto:a@b.dev)";
    expect(rewrite(source)).toBe(source);
  });

  it("leaves non-content relative links alone", () => {
    const source = "![shot](./img/shot.png) [dl](../assets/pack.zip)";
    expect(rewrite(source)).toBe(source);
  });

  it("leaves a link escaping the docs root verbatim", () => {
    expect(rewrite("[readme](../../README.md)")).toBe("[readme](../../README.md)");
  });

  it("leaves links inside a fenced code block", () => {
    const source = "before [a](./2.usage.md)\n\n```md\n[a](./2.usage.md)\n```\n\nafter";
    expect(rewrite(source)).toBe(
      "before [a](/guide/usage)\n\n```md\n[a](./2.usage.md)\n```\n\nafter",
    );
  });

  it("only closes a fence with the same character, undecorated", () => {
    const source = "~~~md\n[a](./2.usage.md)\n```\n[b](./2.usage.md)\n~~~\n[c](./2.usage.md)";
    expect(rewrite(source)).toBe(
      "~~~md\n[a](./2.usage.md)\n```\n[b](./2.usage.md)\n~~~\n[c](/guide/usage)",
    );
  });

  it("closes on a longer fence of the same character (CommonMark)", () => {
    const source = "```\n[a](./2.usage.md)\n````\n[b](./2.usage.md)";
    expect(rewrite(source)).toBe("```\n[a](./2.usage.md)\n````\n[b](/guide/usage)");
  });

  it("treats an unterminated fence as running to the end", () => {
    const source = "```\n[a](./2.usage.md)\n";
    expect(rewrite(source)).toBe(source);
  });
});
