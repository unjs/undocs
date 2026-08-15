import { describe, it, expect } from "vitest";
import {
  firstDocsPage,
  isBlogPath,
  mobileNavLinks,
  navBreadcrumb,
} from "../../src/app/utils/nav.ts";
import type { NavItem } from "../../src/server/content/types.ts";

// The trees below mirror what `buildNavigation` actually emits — in particular
// the index-LESS directory, which is a `page: false` group whose path is
// borrowed from its first child (pinned by
// `test/content/builder.test.ts` → "builds an index-less directory into a
// page-less group keyed by its first child"). Every consumer that singles out
// the blog has to cope with that shape, since a `blog/` with posts and no
// `index.md` is the common case.

/** `blog/hello.md` + `blog/world.md`, no `blog/index.md`. */
const indexlessBlog: NavItem = {
  title: "Blog",
  path: "/blog/hello",
  page: false,
  children: [
    { title: "Hello", path: "/blog/hello", page: true },
    { title: "World", path: "/blog/world", page: true },
  ],
};

/** `blog/index.md` (titled "News") + one post. */
const titledBlog: NavItem = {
  title: "News",
  path: "/blog",
  page: true,
  children: [
    { title: "News", path: "/blog", page: true },
    { title: "Hello", path: "/blog/hello", page: true },
  ],
};

const guide: NavItem = {
  title: "Guide",
  path: "/guide",
  page: true,
  children: [
    { title: "Getting Started", path: "/guide", page: true },
    { title: "Install", path: "/guide/install", page: true },
  ],
};

describe("isBlogPath", () => {
  it("matches the blog index and its posts", () => {
    expect(isBlogPath("/blog")).toBe(true);
    expect(isBlogPath("/blog/hello")).toBe(true);
    expect(isBlogPath("/blog/2024/hello")).toBe(true);
  });

  it("does not match a sibling that merely shares the prefix", () => {
    expect(isBlogPath("/blogging")).toBe(false);
    expect(isBlogPath("/guide")).toBe(false);
    expect(isBlogPath("/")).toBe(false);
    expect(isBlogPath(undefined)).toBe(false);
  });
});

describe("firstDocsPage", () => {
  it("skips the blog even when it has no index page", () => {
    // The landing's "Get Started" CTA — an `=== '/blog'` test missed the
    // index-less group (`/blog/hello`) and sent readers to a blog post.
    expect(firstDocsPage([indexlessBlog, guide])).toBe("/guide");
    expect(firstDocsPage([titledBlog, guide])).toBe("/guide");
  });

  it("descends into the first real section", () => {
    expect(firstDocsPage([guide])).toBe("/guide");
    expect(firstDocsPage([])).toBeUndefined();
    expect(firstDocsPage([indexlessBlog])).toBeUndefined();
  });
});

describe("mobileNavLinks", () => {
  it("collapses an index-less blog to a single link", () => {
    const links = mobileNavLinks([indexlessBlog, guide]);
    expect(links[0].title).toBe("Blog");
    expect(links[0].children).toBeUndefined();
  });

  it("collapses a blog whose index is titled something else", () => {
    const links = mobileNavLinks([titledBlog]);
    expect(links[0].title).toBe("News");
    expect(links[0].children).toBeUndefined();
  });

  it("keeps a section title the author supplied in .navigation.yml", () => {
    // `cli/.navigation.yml` → `title: Command Line`, beside a `cli/index.md`.
    // The header only falls back to the directory segment because a DERIVED
    // title would repeat the index child; an author-named one repeats nothing,
    // and re-deriving it both discarded the config and handed "cli" to
    // `titleCase` (which knows "API" and no other acronym) — so the drawer said
    // "Cli" while the tabs and the sidebar said "Command Line".
    const cli: NavItem = {
      title: "Command Line",
      path: "/cli",
      page: true,
      titleFromConfig: true,
      children: [
        { title: "CLI", path: "/cli", page: true },
        { title: "Usage", path: "/cli/usage", page: true },
      ],
    };
    const [header] = mobileNavLinks([cli]);
    expect(header.title).toBe("Command Line");
    expect(header.children?.map((c) => c.title)).toEqual(["CLI", "Usage"]);
  });

  it("leaves the source items untouched", () => {
    mobileNavLinks([indexlessBlog]);
    expect(indexlessBlog.children).toHaveLength(2);
  });
});

describe("navBreadcrumb", () => {
  // `docs/` with an index, holding an index-LESS `api/` subsection.
  const api: NavItem = {
    title: "API",
    path: "/docs/api/first",
    page: false,
    children: [
      { title: "First", path: "/docs/api/first", page: true },
      { title: "Second", path: "/docs/api/second", page: true },
    ],
  };
  const docs: NavItem = {
    title: "Docs",
    path: "/docs",
    page: true,
    children: [{ title: "Docs", path: "/docs", page: true }, { ...api }],
  };

  it("names an index-less subsection for every page in it", () => {
    // Prefix-matching the subsection's own (borrowed) path answered `/docs/api/first`
    // and nothing else, so a reader on any later page got no trail at all.
    for (const path of ["/docs/api/first", "/docs/api/second"]) {
      expect(navBreadcrumb([docs], path)).toEqual([{ label: "API", icon: undefined, to: "" }]);
    }
  });

  it("skips the top-level section and pages that are not in one", () => {
    expect(navBreadcrumb([docs], "/docs")).toEqual([]);
    expect(navBreadcrumb([guide], "/guide/install")).toEqual([]);
    expect(navBreadcrumb([docs], "/elsewhere")).toEqual([]);
    expect(navBreadcrumb(undefined, "/docs/api/second")).toEqual([]);
  });

  it("links a subsection that has an index page of its own", () => {
    const nested: NavItem = {
      title: "Docs",
      path: "/docs",
      page: true,
      children: [
        { title: "Docs", path: "/docs", page: true },
        {
          title: "API",
          path: "/docs/api",
          page: true,
          icon: "i-lucide-code",
          children: [
            { title: "API", path: "/docs/api", page: true },
            { title: "Second", path: "/docs/api/second", page: true },
          ],
        },
      ],
    };
    expect(navBreadcrumb([nested], "/docs/api/second")).toEqual([
      { label: "API", icon: "i-lucide-code", to: "/docs/api" },
    ]);
  });
});
