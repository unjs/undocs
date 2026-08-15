import { describe, it, expect } from "vitest";
import { tokens, typeOf, coverage, html } from "./helper.ts";

/**
 * Samples lifted VERBATIM from `docs/1.guide/2.components.md` and
 * `docs/1.guide/5.custom-theme.md` — the ```mdc fences this grammar exists to
 * fix. Between them they cover every construct that actually ships in undocs'
 * own docs: nested blocks, prop bags, YAML props, slots, headings inside a
 * block, inline components and spans.
 */

/** `docs/1.guide/2.components.md` — "Tabs". */
const TABS = `::tabs
  ::tab{label="npm" icon="i-lucide-package"}
  Content shown under the **npm** tab.
  ::
  ::tab{label="pnpm" icon="i-lucide-package"}
  Content shown under the **pnpm** tab.
  ::
::`;

/** `docs/1.guide/2.components.md` — "Steps". Headings live INSIDE the block. */
const STEPS = `::steps
#### Install the package

:pm-install{name="undocs"}

#### Run the dev server

:pm-run{script="dev"}

#### Ship your docs 🚀
::`;

/** `docs/1.guide/2.components.md` — "Cards". Props come from YAML, not a bag. */
const CARDS = `::card-group{cols="2"}
  ::card
  ---
  title: Getting Started
  icon: i-lucide-rocket
  to: /guide
  ---
  Install undocs and scaffold your first docs site.
  ::
  ::card
  ---
  title: Components
  icon: i-lucide-puzzle
  to: /guide/components
  ---
  Alerts, tabs, cards and more, straight from markdown.
  ::
::`;

/** `docs/1.guide/5.custom-theme.md` — named slots + a span. */
const HERO = `::page-hero{orientation="horizontal"}
#title
Build [Amazing]{.text-primary} Docs

#description
Ship your Markdown with a landing page that looks like your product.

#links
:read-more{to="/guide" title="Get started"}
::`;

/** Plain markdown with no MDC in it at all. */
const PLAIN_MD = `# Title

Some **bold** and _italic_ text with a [link](https://unjs.io).

* one
* two

1. first
2. second

\`\`\`ts
export const x = 1;
\`\`\``;

/** Every `type` a token whose (trimmed) text is exactly `needle` was given. */
function typesOf(code: string, needle: string): string[] {
  return tokens(code, "mdc")
    .filter((t) => t.text.trim() === needle)
    .map((t) => t.type);
}

describe("mdc grammar", () => {
  describe("block components", () => {
    it("splits an opening line into delimiter and component name", () => {
      expect(typesOf("::note\nBody.\n::", "::")).toEqual(["oper", "oper"]);
      expect(typesOf("::note\nBody.\n::", "note")).toEqual(["kwd"]);
    });

    it("closes on a bare `::`", () => {
      const t = tokens("::note\nBody.\n::", "mdc");
      expect(t.at(-1)).toEqual({ type: "oper", text: "::" });
    });

    it("handles the deeper `:::` / `::::` delimiters used for nesting", () => {
      const src = `::hero
  :::card
    ::::card{title="Card title" .red}
      A **super** nested card
    ::::
  :::
::`;
      expect(typesOf(src, ":::")).toEqual(["oper", "oper"]);
      expect(typesOf(src, "::::")).toEqual(["oper", "oper"]);
      expect(typesOf(src, "card")).toEqual(["kwd", "kwd"]);
    });

    it("keeps an indented opener working", () => {
      expect(typesOf(TABS, "::")).toEqual(["oper", "oper", "oper", "oper", "oper", "oper"]);
      expect(typesOf(TABS, "tabs")).toEqual(["kwd"]);
      expect(typesOf(TABS, "tab")).toEqual(["kwd", "kwd"]);
    });

    it("accepts a space between the name and its prop bag", () => {
      const src = `::card { title="Card title" .red}\nx\n::`;
      expect(typeOf(src, "mdc", "title")).toBe("class");
      expect(typeOf(src, "mdc", ".red")).toBe("class");
    });

    it("leaves a mid-line `::` in prose alone", () => {
      const t = tokens("Use the ::note component for asides.", "mdc");
      expect(t.filter((x) => x.text.includes("::"))).toEqual([]);
    });

    it("does not open a block when the line has trailing prose", () => {
      const t = tokens("::note is an alert component.", "mdc");
      expect(t.filter((x) => x.text.includes("::"))).toEqual([]);
    });
  });

  describe("inline components", () => {
    it("splits `:name` into a single-colon delimiter and the name", () => {
      const src = `:pm-install{name="undocs"}`;
      expect(typesOf(src, ":")).toEqual(["oper"]);
      expect(typesOf(src, "pm-install")).toEqual(["kwd"]);
    });

    it("highlights every inline component in the real Steps sample", () => {
      expect(typesOf(STEPS, "pm-install")).toEqual(["kwd"]);
      expect(typesOf(STEPS, "pm-run")).toEqual(["kwd"]);
    });

    it("takes a prop bag with several attributes", () => {
      const src = `:read-more{to="https://unjs.io" title="UnJS Website"}`;
      expect(typesOf(src, "read-more")).toEqual(["kwd"]);
      expect(typesOf(src, "to")).toEqual(["class"]);
      expect(typesOf(src, "title")).toEqual(["class"]);
      expect(typesOf(src, '"https://unjs.io"')).toEqual(["str"]);
    });

    it("takes a `[slot text]` before or after the bag", () => {
      expect(typesOf(`:icon[Docs]{.big}`, "Docs")).toEqual(["str"]);
      expect(typesOf(`:icon[Docs]{.big}`, "[")).toEqual(["oper"]);
      expect(typesOf(`:icon{.big}[Docs]`, "Docs")).toEqual(["str"]);
      expect(typesOf(`:icon{.big}[Docs]`, "]")).toEqual(["oper"]);
    });

    it("leaves ordinary prose colons alone", () => {
      const src = `Note: see https://unjs.io/docs for the 3:4 ratio and a::b.`;
      const t = tokens(src, "mdc");
      expect(t.filter((x) => x.type === "kwd")).toEqual([]);
      expect(t.filter((x) => x.type === "oper")).toEqual([]);
    });
  });

  describe("prop bags", () => {
    const bag = (attrs: string) => `::card{${attrs}}\nx\n::`;

    it("colours names, `=` and quoted values separately", () => {
      const src = bag(`label="npm" icon="i-lucide-package"`);
      expect(typesOf(src, "label")).toEqual(["class"]);
      expect(typesOf(src, "=")).toEqual(["oper", "oper"]);
      expect(typesOf(src, '"npm"')).toEqual(["str"]);
      expect(typesOf(src, "{")).toEqual(["oper"]);
      expect(typesOf(src, "}")).toEqual(["oper"]);
    });

    it("accepts single-quoted and bare values", () => {
      expect(typesOf(bag(`to='/guide'`), "'/guide'")).toEqual(["str"]);
      expect(typesOf(bag(`cols=2`), "2")).toEqual(["str"]);
    });

    it("treats the `.class` and `#id` shorthands as attribute names", () => {
      expect(typesOf(bag(`.w-30.mb-5`), ".w-30.mb-5")).toEqual(["class"]);
      expect(typesOf(bag(`#nuxt-logo`), "#nuxt-logo")).toEqual(["class"]);
    });

    it("accepts a valueless attribute", () => {
      const src = bag(`defaultValue="src/app.ts" expandAll`);
      expect(typesOf(src, "expandAll")).toEqual(["class"]);
    });

    it("attaches a bag to any inline element it follows", () => {
      expect(typeOf(`**bold**{style="color: blue"}`, "mdc", "style")).toBe("class");
      expect(typeOf(`[Link](https://nuxt.com){class="nuxt"}`, "mdc", "class")).toBe("class");
      expect(typeOf('`code`{style="color: red"}', "mdc", "style")).toBe("class");
    });

    it("ignores a detached `{ ... }` in prose", () => {
      const t = tokens("A lone { brace } and a set { of words } in prose.", "mdc");
      expect(t).toEqual([]);
    });
  });

  describe("`#slot` vs `#heading`", () => {
    it("reads a lone `#name` line as a slot", () => {
      expect(typesOf(HERO, "#")).toEqual(["oper", "oper", "oper"]);
      expect(typesOf(HERO, "title")).toEqual(["class", "class"]);
      expect(typesOf(HERO, "description")).toEqual(["class"]);
      expect(typesOf(HERO, "links")).toEqual(["class"]);
    });

    it("reads `#### text` as a heading, not a slot", () => {
      expect(typesOf(STEPS, "####")).toEqual(["oper", "oper", "oper"]);
      expect(typeOf(STEPS, "mdc", "Install the package")).toBe("section");
      expect(typesOf(STEPS, "Install the package")).not.toContain("class");
    });

    it("keeps both straight in one document", () => {
      const src = `::steps
#title
#### Install the package
#description
##### Run it
::`;
      const t = tokens(src, "mdc");
      const byText = (needle: string) => t.find((x) => x.text.includes(needle));
      expect(byText("title")).toMatchObject({ type: "class" });
      expect(byText("Install the package")).toMatchObject({ type: "section" });
      expect(byText("description")).toMatchObject({ type: "class" });
      expect(byText("Run it")).toMatchObject({ type: "section" });
    });

    it("does not mistake a shebang or a 7-hash line for a heading", () => {
      expect(tokens("#!/usr/bin/env node", "mdc")).toEqual([]);
      expect(tokens("####### not a heading", "mdc")).toEqual([]);
    });
  });

  describe("YAML prop blocks", () => {
    it("marks the `---` fences under a component opener", () => {
      expect(typesOf(CARDS, "---")).toEqual(["oper", "oper", "oper", "oper"]);
    });

    it("marks document frontmatter at the very start", () => {
      const src = `---\nicon: i-lucide-puzzle\n---\n\n# Components`;
      expect(typesOf(src, "---")).toEqual(["oper", "oper"]);
    });

    it("does not pair unrelated thematic breaks into a prop block", () => {
      const src = `Some text.\n\n---\n\nMore text.\n\n---\n\nEnd.`;
      // The base `md` grammar's setext rule claims these as `cmnt`; the point is
      // that MDC's prop-block rule does NOT, so the prose between them survives.
      expect(typesOf(src, "---")).toEqual(["cmnt", "cmnt"]);
      expect(typeOf(src, "mdc", "More text")).toBeUndefined();
    });
  });

  describe("spans", () => {
    it("highlights `[text]{.class}`", () => {
      const src = `Build [Amazing]{.text-primary} Docs`;
      expect(typesOf(src, "[")).toEqual(["oper"]);
      expect(typesOf(src, "Amazing")).toEqual(["str"]);
      expect(typesOf(src, ".text-primary")).toEqual(["class"]);
    });

    it("leaves a normal markdown link to the base grammar", () => {
      expect(typeOf(`See [the guide](/guide).`, "mdc", "[the guide]")).toBe("oper");
      expect(typeOf(`See [the guide](/guide).`, "mdc", "(/guide)")).toBe("func");
    });
  });

  describe("bindings", () => {
    it("highlights `{{ value }}`", () => {
      expect(typesOf(`{{ title }}`, "{{")).toEqual(["oper"]);
      expect(typesOf(`{{ title }}`, "title")).toEqual(["var"]);
      expect(typesOf(`{{ title }}`, "}}")).toEqual(["oper"]);
    });

    it("splits the `||` fallback off", () => {
      const src = `{{ subtitle || "Docs" }}`;
      expect(typesOf(src, "||")).toEqual(["oper"]);
      expect(typesOf(src, '"Docs"')).toEqual(["str"]);
    });
  });

  describe("markdown superset", () => {
    it("still highlights headings, emphasis, links and lists", () => {
      expect(typeOf(PLAIN_MD, "mdc", "Title")).toBe("section");
      expect(typesOf(PLAIN_MD, "**bold**")).toEqual(["class"]);
      expect(typesOf(PLAIN_MD, "_italic_")).toEqual(["kwd"]);
      expect(typeOf(PLAIN_MD, "mdc", "[link]")).toBe("oper");
      expect(typesOf(PLAIN_MD, "*")).toEqual(["kwd", "kwd"]);
      expect(typesOf(PLAIN_MD, "1.")).toEqual(["kwd"]);
    });

    it("still delegates a fenced code block to its own language", () => {
      expect(typesOf(PLAIN_MD, "export")).toEqual(["kwd"]);
      expect(typesOf(PLAIN_MD, "const")).toEqual(["kwd"]);
      expect(typesOf(PLAIN_MD, "1")).toEqual(["num"]);
    });

    it("never tokenizes plain markdown WORSE than the base grammar", () => {
      const asMdc = coverage(PLAIN_MD, "mdc");
      expect(asMdc).toBeGreaterThanOrEqual(coverage(PLAIN_MD, "md"));
      expect(asMdc).toBeGreaterThan(62);
    });

    it("does not let MDC rules reach inside a nested fenced block", () => {
      const src = "::code-group\n```md\n::note\nBody.\n::\n```\n::";
      // Only the `::` OUTSIDE the fence are delimiters: the opener and the
      // closer. The two inside the ```md block stay plain, because md's fence
      // rule matches at the backtick — an earlier index than any of them.
      expect(typesOf(src, "::")).toEqual(["oper", "oper"]);
      expect(typesOf(src, "code-group")).toEqual(["kwd"]);
    });
  });

  describe("registration", () => {
    it("resolves under both `mdc` and the `comark` alias", () => {
      expect(html(TABS, "mdc")).toContain("code-hl-lang-mdc");
      expect(html(TABS, "comark")).toContain("code-hl-lang-mdc");
      // Alias resolution lives in `highlightCode`, so it has to be asserted
      // through it: the `languages` record rangi is handed is keyed by grammar
      // NAME only, and a raw `tokenize(code, { lang: "comark" })` would fall
      // through to `plain`. Identical markup is the real claim anyway.
      expect(html(TABS, "comark")).toBe(html(TABS, "mdc"));
    });
  });

  describe("coverage", () => {
    // Measured against the `md` fallback this grammar replaces. rangi 2.1 gave
    // `md` a heading rule, which lifted that baseline sharply on the
    // heading-heavy samples (steps 0% → 51%, cards 5% → 22%) — so these compare
    // the two side by side rather than asserting a fixed ceiling on `md`, which
    // would just break again the next time upstream improves.
    //
    // Today: tabs 9→70, steps 51→100, cards 22→34, hero 0→66, combined 18→61.
    // The floors sit a few points under what mdc actually reaches. Markdown
    // grammars are low by nature (prose is legitimately untokenized), so these
    // are regression guards, not targets.
    const lift = (code: string) => ({ md: coverage(code, "md"), mdc: coverage(code, "mdc") });

    it("lifts the Tabs sample well clear of the md fallback", () => {
      const { md, mdc } = lift(TABS);
      expect(mdc).toBeGreaterThan(65);
      expect(mdc - md).toBeGreaterThan(50);
    });

    it("lifts the Steps sample", () => {
      const { md, mdc } = lift(STEPS);
      expect(mdc).toBeGreaterThan(95);
      expect(mdc - md).toBeGreaterThan(40);
    });

    it("lifts the Cards sample, whose props are YAML", () => {
      const { md, mdc } = lift(CARDS);
      expect(mdc).toBeGreaterThan(30);
      expect(mdc - md).toBeGreaterThan(10);
    });

    it("lifts the page-hero sample", () => {
      const { md, mdc } = lift(HERO);
      expect(mdc).toBeGreaterThan(60);
      expect(mdc - md).toBeGreaterThan(55);
    });

    it("lifts a component-heavy document overall", () => {
      const { md, mdc } = lift([TABS, STEPS, CARDS, HERO].join("\n\n"));
      expect(mdc).toBeGreaterThan(55);
      expect(mdc - md).toBeGreaterThan(35);
    });
  });
});
