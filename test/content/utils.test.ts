import { describe, it, expect } from "vitest";
import {
  isIndexFile,
  isReadmeFile,
  stripPrefix,
  toRoutePath,
  orderKey,
  textContent,
  slugify,
  titleCase,
} from "../../src/server/content/utils.ts";
import type { MarkNode } from "../../src/server/content/types.ts";

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
    expect(orderKey("2.usage.md")).toBe("000002.usage.md");
    expect(orderKey("2.a.md") < orderKey("10.a.md")).toBe(true);
  });

  it("orders numbered segments before un-numbered ones", () => {
    expect(orderKey("1.a") < orderKey("a")).toBe(true);
  });

  it("keeps per-segment ordering", () => {
    expect(orderKey("1.guide/2.b.md") < orderKey("1.guide/10.b.md")).toBe(true);
    expect(orderKey("1.guide/2.b.md") < orderKey("2.config/1.b.md")).toBe(true);
  });

  it("keeps the segment name, so same-numbered siblings stay distinct", () => {
    // Dropping the name made `1.alpha.md` and `1.beta.md` — and every page under
    // `1.guide/` and `1.api/` — key identically, leaving their order to readdir.
    expect(orderKey("1.alpha.md")).not.toBe(orderKey("1.beta.md"));
    expect(orderKey("1.alpha.md") < orderKey("1.beta.md")).toBe(true);
    expect(orderKey("1.api/1.core.md")).not.toBe(orderKey("1.guide/1.install.md"));
  });

  it("groups a directory's pages together regardless of a shared number", () => {
    const keys = [
      "1.guide/1.install.md",
      "1.api/1.core.md",
      "1.guide/2.usage.md",
      "1.api/2.plugins.md",
    ].sort((a, b) => orderKey(a).localeCompare(orderKey(b)));
    expect(keys).toEqual([
      "1.api/1.core.md",
      "1.api/2.plugins.md",
      "1.guide/1.install.md",
      "1.guide/2.usage.md",
    ]);
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

  // The strip used to be `\w`, which is ASCII-only: a Cyrillic or CJK heading
  // slugged to the EMPTY string, and an empty id means no anchor and a dead TOC
  // link. An accented Latin heading lost only the accented letter, which is the
  // same bug with a survivor.
  it("keeps non-Latin letters and digits", () => {
    expect(slugify("Установка")).toBe("установка");
    expect(slugify("Быстрый старт")).toBe("быстрый-старт");
    expect(slugify("安装")).toBe("安装");
    expect(slugify("インストール 2")).toBe("インストール-2");
    expect(slugify("Émoji 🚀 heading")).toBe("émoji-heading");
    expect(slugify("Ünicode Größe")).toBe("ünicode-größe");
  });

  it("keeps underscores (they were inside the old `\\w`)", () => {
    expect(slugify("max_age option")).toBe("max_age-option");
  });

  it("still yields nothing for a heading with no letters or digits", () => {
    expect(slugify("🚀")).toBe("");
    expect(slugify("!!!")).toBe("");
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

describe("README as an index alias", () => {
  it("maps README.md to its directory, like index.md", () => {
    expect(toRoutePath("README.md")).toBe("/");
    expect(toRoutePath("1.guide/README.md")).toBe("/guide");
    expect(toRoutePath("1.guide/2.api/README.md")).toBe("/guide/api");
  });

  it("matches any casing, prefixed or not", () => {
    for (const rel of ["README.md", "readme.md", "ReadMe.md", "1.README.md"]) {
      expect(isIndexFile(rel)).toBe(true);
      expect(isReadmeFile(rel)).toBe(true);
      expect(toRoutePath(rel)).toBe("/");
    }
  });

  it("still treats index.md as the canonical spelling", () => {
    expect(isIndexFile("index.md")).toBe(true);
    expect(isReadmeFile("index.md")).toBe(false);
  });

  it("leaves an ordinary page alone", () => {
    expect(isIndexFile("guide/usage.md")).toBe(false);
    // Only the whole name matches — `readme-first.md` is a page.
    expect(isIndexFile("readme-first.md")).toBe(false);
    expect(toRoutePath("readme-first.md")).toBe("/readme-first");
  });
});

describe("textContent: raw html", () => {
  // `liftRawHtml` merges a matched inline pair and the prose between it into one
  // `_html` node, so skipping the node wholesale dropped that prose from the
  // heading's TOC entry (and from search) while its id still spelled it out.
  it("reads the prose out of an inline raw-html node, tags excluded", () => {
    const node: MarkNode = ["h2", { id: "x" }, "Heading with ", ["_html", {}, "<em>markup</em>"]];
    expect(textContent(node)).toBe("Heading with markup");
  });

  it("reads nothing out of a block raw-html node", () => {
    const node: MarkNode = ["_html", { block: true }, '<div align="center">hi</div>'];
    expect(textContent(node)).toBe("");
  });

  it("reads nothing out of a lone inline tag", () => {
    expect(textContent(["p", {}, "a", ["_html", {}, "<br>"], "b"])).toBe("ab");
  });
});
