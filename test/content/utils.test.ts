import { describe, it, expect } from "vitest";
import {
  stripPrefix,
  toRoutePath,
  orderKey,
  textContent,
  slugify,
  titleCase,
} from "../../src/server/content/utils";
import type { MarkNode } from "../../src/server/content/types";

describe("stripPrefix", () => {
  it("removes a leading numeric order prefix", () => {
    expect(stripPrefix("1.guide")).toBe("guide");
    expect(stripPrefix("12.index.md")).toBe("index.md");
  });

  it("leaves un-prefixed segments untouched", () => {
    expect(stripPrefix("guide")).toBe("guide");
    expect(stripPrefix("v1.2")).toBe("v1.2");
  });
});

describe("toRoutePath", () => {
  it("strips extension and order prefixes", () => {
    expect(toRoutePath("1.guide/2.usage.md")).toBe("/guide/usage");
  });

  it("drops a trailing index segment", () => {
    expect(toRoutePath("1.guide/1.index.md")).toBe("/guide");
  });

  it("maps a root index to /", () => {
    expect(toRoutePath("index.md")).toBe("/");
  });

  it("handles .yml files", () => {
    expect(toRoutePath("1.guide/config.yml")).toBe("/guide/config");
  });
});

describe("orderKey", () => {
  it("zero-pads numeric prefixes so string sort matches numeric order", () => {
    expect(orderKey("2.usage.md")).toBe("000002");
    expect(orderKey("2.a.md") < orderKey("10.a.md")).toBe(true);
  });

  it("orders numbered segments before un-numbered ones", () => {
    expect(orderKey("1.a") < orderKey("a")).toBe(true);
  });

  it("keeps per-segment ordering", () => {
    expect(orderKey("1.guide/2.b.md") < orderKey("1.guide/10.b.md")).toBe(true);
    expect(orderKey("1.guide/2.b.md") < orderKey("2.config/1.b.md")).toBe(true);
  });
});

describe("textContent", () => {
  it("returns strings verbatim", () => {
    expect(textContent("hello")).toBe("hello");
  });

  it("returns empty for null/undefined", () => {
    expect(textContent(null)).toBe("");
    expect(textContent(undefined)).toBe("");
  });

  it("concatenates nested children", () => {
    const node: MarkNode = ["p", {}, "hello ", ["strong", {}, "world"]];
    expect(textContent(node)).toBe("hello world");
  });

  it("skips HTML comment nodes (tag === null)", () => {
    const node: MarkNode = [null, {}, "a comment"];
    expect(textContent(node)).toBe("");
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips html tags and punctuation", () => {
    expect(slugify("Foo <b>Bar</b>!")).toBe("foo-bar");
  });

  it("collapses repeated separators and trims edges", () => {
    expect(slugify("  a --  b  ")).toBe("a-b");
  });
});

describe("titleCase", () => {
  it("title-cases hyphen/underscore separated words", () => {
    expect(titleCase("getting-started")).toBe("Getting Started");
    expect(titleCase("my_cool_page")).toBe("My Cool Page");
  });

  it("upper-cases a standalone 'api' word", () => {
    expect(titleCase("api")).toBe("API");
    expect(titleCase("rest-api-guide")).toBe("Rest API Guide");
  });
});
