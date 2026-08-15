import { describe, it, expect } from "vitest";
import { resolveLanding } from "../../src/app/composables/useLanding.ts";
import {
  countNavRows,
  docsNavTree,
  firstDocsPage,
  isWithin,
  mobileNavLinks,
  navContains,
} from "../../src/app/utils/nav.ts";
import type { NavItem } from "../../src/server/content/types.ts";

// Shapes taken from `buildNavigation`'s output: the docs-root `index.md` is the
// item flagged `root`, a section is an item with children, and a top-level page
// is a childless item.
const rootPage: NavItem = { title: "Home", path: "/", page: true, root: true };
const page = (path: string): NavItem => ({ title: path, path, page: true });
const section = (path: string): NavItem => ({
  title: path,
  path,
  page: true,
  children: [page(path), page(`${path}/usage`)],
});
// An index-less directory: `builder.ts` borrows its path from the first child
// and marks it `page: false`.
const group = (path: string): NavItem => ({
  title: path,
  path: `${path}/one`,
  page: false,
  children: [page(`${path}/one`)],
});

describe("resolveLanding", () => {
  describe("explicit config wins over the content tree", () => {
    it("`landing: false` turns the landing off, whatever the tree looks like", () => {
      expect(resolveLanding({ landing: false }, [rootPage, section("/guide")])).toBe(false);
      expect(resolveLanding({ landing: false }, [])).toBe(false);
    });

    it("`landing: true` turns it on, symmetrically — the flat tree would say no", () => {
      // The one thing configuration alone cannot express: wanting a hero before
      // there is anything to put in it.
      expect(resolveLanding({ landing: true }, [rootPage])).toBe(true);
      expect(resolveLanding({ landing: true }, [rootPage, page("/another")])).toBe(true);
    });

    it("a configured landing turns it on, even for a flat page tree", () => {
      const flat = [rootPage, page("/another")];
      expect(resolveLanding({ landing: { heroTitle: "Hi" } }, flat)).toBe(true);
    });

    it("an empty `landing: {}` is not a configuration — it falls through to the tree", () => {
      expect(resolveLanding({ landing: {} }, [rootPage, page("/another")])).toBe(false);
    });
  });

  describe("inferred from the content tree", () => {
    it("keeps the landing when there is no root page at all — nothing else serves `/`", () => {
      // undocs' own docs: sections only, landing driven purely by config.
      expect(resolveLanding({}, [section("/guide"), section("/config")])).toBe(true);
      // Flat, but still nothing at `/` — the landing is the only answer.
      expect(resolveLanding({}, [page("/faq"), page("/api")])).toBe(true);
      expect(resolveLanding({}, [])).toBe(true);
      expect(resolveLanding({}, null)).toBe(true);
    });

    it("keeps the landing for a root page over sections (the common UnJS layout)", () => {
      expect(resolveLanding({}, [rootPage, section("/guide"), section("/config")])).toBe(true);
      // Mixed: still sectioned, so `/` sits above the structure.
      expect(resolveLanding({}, [rootPage, page("/faq"), section("/guide")])).toBe(true);
    });

    it("counts an index-less directory as a section", () => {
      expect(resolveLanding({}, [rootPage, group("/api")])).toBe(true);
    });

    it("drops the landing for flat docs — the root page is the home page", () => {
      // The starter template: one `README.md` and nothing else.
      expect(resolveLanding({}, [rootPage])).toBe(false);
      expect(resolveLanding({}, [rootPage, page("/another")])).toBe(false);
      expect(resolveLanding({}, [rootPage, page("/another"), page("/faq")])).toBe(false);
    });
  });
});

describe("isWithin", () => {
  it("matches a route against itself", () => {
    expect(isWithin("/guide", "/guide")).toBe(true);
    expect(isWithin("/", "/")).toBe(true);
  });

  it("matches descendants on a segment boundary", () => {
    expect(isWithin("/guide/usage", "/guide")).toBe(true);
    expect(isWithin("/guide/deep/page", "/guide")).toBe(true);
  });

  it("does not let the docs root claim every page", () => {
    // The reason this helper exists: `"/another".startsWith("/")` is true, so a
    // plain prefix test highlights the root nav item on every single page.
    expect(isWithin("/another", "/")).toBe(false);
    expect(isWithin("/guide/usage", "/")).toBe(false);
  });

  it("does not match a partial segment", () => {
    expect(isWithin("/guides-old", "/guide")).toBe(false);
  });

  it("is false for a missing base", () => {
    expect(isWithin("/guide", "")).toBe(false);
    expect(isWithin("/guide", undefined)).toBe(false);
  });
});

describe("navContains", () => {
  it("matches an item's own subtree by path", () => {
    expect(navContains(section("/guide"), "/guide/usage")).toBe(true);
    expect(navContains(section("/guide"), "/api")).toBe(false);
  });

  it("matches through children that share no prefix with the parent", () => {
    // The synthetic section's whole point: `/` and `/another` are not under its
    // path, so only its contents can answer.
    const docs = docsNavTree([rootPage, page("/another"), section("/guide")], false)[0];
    expect(docs.title).toBe("Home");
    expect(navContains(docs, "/")).toBe(true);
    expect(navContains(docs, "/another")).toBe(true);
    expect(navContains(docs, "/guide/usage")).toBe(false);
  });
});

describe("docsNavTree", () => {
  it("drops the root item in landing mode", () => {
    const tree = docsNavTree([rootPage, section("/guide")], true);
    expect(tree.map((i) => i.path)).toEqual(["/guide"]);
  });

  it("groups loose top-level pages into one section beside the real sections", () => {
    const tree = docsNavTree([rootPage, page("/another"), section("/guide")], false);
    expect(tree).toHaveLength(2);
    expect(tree[0]).toMatchObject({
      title: "Home",
      icon: "i-lucide-house",
      path: "/",
      synthetic: true,
    });
    expect(tree[0].children?.map((c) => c.path)).toEqual(["/", "/another"]);
    expect(tree[1].path).toBe("/guide");
  });

  it("takes the position of the first page it absorbs, so a leading section stays first", () => {
    const tree = docsNavTree([section("/guide"), page("/faq"), page("/changelog")], false);
    expect(tree.map((i) => i.title)).toEqual(["/guide", "Home"]);
    expect(tree[1].children?.map((c) => c.path)).toEqual(["/faq", "/changelog"]);
  });

  it("leaves a section-only tree alone (nothing loose to gather)", () => {
    const tree = docsNavTree([section("/guide"), section("/api")], false);
    expect(tree.map((i) => i.path)).toEqual(["/guide", "/api"]);
  });

  it("leaves a flat tree alone — a lone section would just repeat the sidebar", () => {
    const flat = [rootPage, page("/another")];
    const tree = docsNavTree(flat, false);
    expect(tree).toEqual(flat);
    expect(tree.some((i) => i.synthetic)).toBe(false);
  });
});

describe("firstDocsPage", () => {
  it("descends into the first section, since a landing CTA wants a page not a heading", () => {
    expect(firstDocsPage([section("/guide"), section("/api")])).toBe("/guide");
  });

  it("resolves an index-less directory through its first child", () => {
    // `builder.ts` marks it `page: false` and borrows the child's path, so both
    // the item and the descent give the same route.
    expect(firstDocsPage([group("/recipes"), section("/guide")])).toBe("/recipes/one");
  });

  it("takes a top-level page as-is", () => {
    expect(firstDocsPage([page("/install"), section("/guide")])).toBe("/install");
  });

  it("is read from the SHAPED tree, so landing mode has already dropped the root", () => {
    const raw = [rootPage, section("/guide")];
    expect(firstDocsPage(docsNavTree(raw, true))).toBe("/guide");
    // Without a landing, `/` is an ordinary page and is a legitimate answer.
    expect(firstDocsPage(docsNavTree(raw, false))).toBe("/");
  });

  it("skips the blog — it sits beside the docs rather than opening them", () => {
    const blog: NavItem = {
      title: "Blog",
      path: "/blog",
      page: true,
      children: [page("/blog/hi")],
    };
    expect(firstDocsPage([blog, section("/guide")])).toBe("/guide");
  });

  it("returns undefined when there is nowhere to go, so the caller can drop the link", () => {
    expect(firstDocsPage([])).toBeUndefined();
    expect(firstDocsPage(null)).toBeUndefined();
    expect(firstDocsPage([{ title: "Blog", path: "/blog" }])).toBeUndefined();
  });
});

describe("mobileNavLinks", () => {
  // `builder.ts` titles a section FROM its index page and re-adds that page as
  // the section's first child, so both read the same in a collapsible drawer.
  const guide: NavItem = {
    title: "Getting Started",
    path: "/guide",
    page: true,
    children: [
      { title: "Getting Started", path: "/guide", page: true },
      { title: "Components", path: "/guide/components", page: true },
    ],
  };

  it("names a section from its directory so the header does not repeat its index child", () => {
    const [header] = mobileNavLinks([guide]);
    expect(header.title).toBe("Guide");
    expect(header.children?.map((c) => c.title)).toEqual(["Getting Started", "Components"]);
  });

  it("never retitles the shared tree in place", () => {
    // The drawer only renders once opened; mutating here would rename the
    // section in the tabs and the desktop sidebar the moment a reader did.
    const tree = [guide];
    mobileNavLinks(tree);
    expect(tree[0].title).toBe("Getting Started");
    expect(tree[0].children![0].title).toBe("Getting Started");
  });

  it("leaves an index-less directory titled as its directory", () => {
    // It borrows its path from its first child, which is an ordinary page (not a
    // self-index) — so the header must not be renamed after that page.
    const indexLess: NavItem = {
      title: "API",
      path: "/api/one",
      page: false,
      children: [page("/api/one"), page("/api/two")],
    };
    const [header] = mobileNavLinks([indexLess]);
    expect(header.title).toBe("API");
  });

  it("collapses a one-page section to that page, and Blog to a plain link", () => {
    const blog: NavItem = {
      title: "Blog",
      path: "/blog",
      page: true,
      children: [
        { title: "Blog", path: "/blog", page: true },
        { title: "Post", path: "/blog/post", page: true },
      ],
    };
    const solo: NavItem = {
      title: "Solo",
      path: "/solo",
      page: true,
      children: [{ title: "Solo Page", path: "/solo", page: true }],
    };
    const [only, listing] = mobileNavLinks([solo, blog]);
    expect(only.title).toBe("Solo Page");
    expect(only.children).toBeUndefined();
    expect(listing.title).toBe("Blog");
    expect(listing.children).toBeUndefined();
  });

  it("leaves the synthetic section's name alone", () => {
    const tree = docsNavTree([rootPage, page("/another"), section("/guide")], false);
    const [home] = mobileNavLinks(tree);
    expect(home.title).toBe("Home");
  });
});

describe("countNavRows", () => {
  it("counts every row a group renders, not the entries at the top", () => {
    // One entry, four rows: the header plus `/guide`'s three pages — `/guide`
    // itself is the section's self-index and folds INTO that header.
    const guide: NavItem = {
      title: "Guide",
      path: "/guide",
      page: true,
      children: [page("/guide"), page("/guide/install"), page("/guide/usage")],
    };
    expect(countNavRows([guide])).toBe(3);
  });

  it("keeps the child sharing an index-less group's path — it is a real page", () => {
    // `page: false` means the path was borrowed from the first child, so nothing
    // is folded away and the group renders a header above both of its pages.
    const api: NavItem = {
      title: "API",
      path: "/api/one",
      page: false,
      children: [page("/api/one"), page("/api/two")],
    };
    expect(countNavRows([api])).toBe(3);
  });

  it("reports the single-row cases the sidebar is dropped for", () => {
    // The template: one page, so the aside could only link to the page already
    // on screen.
    expect(countNavRows([rootPage])).toBe(1);
    expect(countNavRows([])).toBe(0);
    expect(countNavRows(undefined)).toBe(0);
    // Two loose pages: now there is somewhere else to go.
    expect(countNavRows([rootPage, page("/another")])).toBe(2);
  });
});
