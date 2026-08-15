import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import MiniSearch from "minisearch";
import { buildIndex } from "../../src/server/content/builder.ts";
import {
  MINISEARCH_OPTIONS,
  MINISEARCH_SEARCH_OPTIONS,
} from "../../src/server/content/search-options.ts";
import type { ContentIndex } from "../../src/server/content/types.ts";

// Build a small on-disk docs fixture and index it once. `buildIndex` is the
// public entry of the content engine, so this exercises scan → parse →
// transform → highlight → navigation → search end to end.
let dir: string;
let index: ContentIndex;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "undocs-test-"));
  await writeFile(
    join(dir, "1.index.md"),
    "---\ntitle: Home\n---\n\n# Home\n\n> Welcome to the docs\n\nIntro text.\n",
  );
  await mkdir(join(dir, "2.guide"), { recursive: true });
  // The Setup section carries a distinctive word (`deepsentinelword`) placed well
  // past the old 500-char cutoff, so the full-text test below proves nothing is
  // truncated out of the index.
  const deepPadding = "padding ".repeat(80); // ~640 chars before the sentinel
  await writeFile(
    join(dir, "2.guide", "1.index.md"),
    `# Guide\n\nGuide overview.\n\n## Setup\n\nInstall it. ${deepPadding}deepsentinelword.\n\n\`\`\`ts\nconst a = 1\n\`\`\`\n`,
  );
  await writeFile(join(dir, "2.guide", "2.usage.md"), "# Usage\n\nHow to use.\n");
  // Page opting out of the nav tree via `navigation: false`.
  await writeFile(
    join(dir, "2.guide", "3.hidden.md"),
    "---\nnavigation: false\n---\n\n# Hidden\n\nNot in the sidebar.\n",
  );
  // Page overriding its nav item via an object-valued `navigation` field.
  await writeFile(
    join(dir, "2.guide", "4.custom.md"),
    "---\nnavigation:\n  title: Custom Label\n  badge: New\n---\n\n# Custom\n\nBody.\n",
  );
  // Whole directory hidden via `.navigation.yml` → `navigation: false`.
  await mkdir(join(dir, "3.secret"), { recursive: true });
  await writeFile(join(dir, "3.secret", ".navigation.yml"), "navigation: false\n");
  await writeFile(join(dir, "3.secret", "1.index.md"), "# Secret\n\nHidden section.\n");
  await writeFile(join(dir, "3.secret", "2.page.md"), "# Secret Page\n\nAlso hidden.\n");
  index = await buildIndex({ dir });
}, 60_000);

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe("buildIndex", () => {
  it("produces a page per markdown file", () => {
    expect(index.pages).toHaveLength(7);
  });

  it("derives route paths and keeps byPath in sync", () => {
    const paths = index.pages.map((p) => p.path).sort();
    expect(paths).toEqual([
      "/",
      "/guide",
      "/guide/custom",
      "/guide/hidden",
      "/guide/usage",
      "/secret",
      "/secret/page",
    ]);
    expect(index.byPath.get("/guide")?.title).toBe("Guide");
    expect(index.byPath.size).toBe(index.pages.length);
  });

  it("reads title from frontmatter/h1 and description from a leading blockquote", () => {
    const home = index.byPath.get("/")!;
    expect(home.title).toBe("Home");
    expect(home.description).toBe("Welcome to the docs");
  });

  it("adds the docs-root index as the tree's first item, flagged `root`", () => {
    // `/` has no path segment, so it is only in the tree because `buildNavigation`
    // special-cases it. The flag is what lets a landing-page site strip it back
    // out (see `resolveLanding`).
    const first = index.navigation[0];
    expect(first.path).toBe("/");
    expect(first.title).toBe("Home");
    expect(first.root).toBe(true);
    expect(first.page).toBe(true);
    expect(first.children).toBeUndefined();
    // Exactly one item carries it, and never a nested one.
    expect(index.navigation.filter((n) => n.root)).toHaveLength(1);
  });

  it("builds a nested navigation tree", () => {
    const guide = index.navigation.find((n) => n.path === "/guide");
    expect(guide).toBeDefined();
    expect(guide!.children?.some((c) => c.path === "/guide/usage")).toBe(true);
  });

  it("excludes pages with `navigation: false` from the nav tree but keeps them routable", () => {
    const guide = index.navigation.find((n) => n.path === "/guide")!;
    expect(guide.children?.some((c) => c.path === "/guide/hidden")).toBe(false);
    // still a real page
    expect(index.byPath.get("/guide/hidden")?.title).toBe("Hidden");
  });

  it("drops a whole directory hidden via `.navigation.yml`", () => {
    expect(index.navigation.some((n) => n.path === "/secret")).toBe(false);
    // pages still exist and are routable
    expect(index.byPath.get("/secret")?.title).toBe("Secret");
    expect(index.byPath.get("/secret/page")?.title).toBe("Secret Page");
  });

  it("applies object-valued `navigation` overrides (title + custom fields)", () => {
    const guide = index.navigation.find((n) => n.path === "/guide")!;
    const custom = guide.children?.find((c) => c.path === "/guide/custom");
    expect(custom?.title).toBe("Custom Label");
    expect(custom?.badge).toBe("New");
  });

  it("indexes search sections including per-heading entries", () => {
    expect(index.search.length).toBeGreaterThan(index.pages.length);
    expect(index.search.some((s) => s.id === "/guide#setup")).toBe(true);
  });

  it("indexes the full section text (no truncation)", () => {
    // `deepsentinelword` sits ~640 chars into the Setup section — past the old
    // 500-char clip. Rehydrate the shipped index and confirm it's searchable.
    const ms = MiniSearch.loadJS(index.searchIndex, MINISEARCH_OPTIONS);
    const hits = ms.search("deepsentinelword", MINISEARCH_SEARCH_OPTIONS);
    expect(hits.some((h) => h.id === "/guide#setup")).toBe(true);
  });

  it("orders content pages", () => {
    expect(index.order).toEqual([
      "/",
      "/guide",
      "/guide/usage",
      "/guide/hidden",
      "/guide/custom",
      "/secret",
      "/secret/page",
    ]);
  });

  it("records build stats", () => {
    expect(index.stats.counts.pages).toBe(7);
    expect(index.stats.counts.codeBlocks).toBe(1);
    expect(index.stats.builtAt).toBeGreaterThan(0);
  });
});

// Edge cases for navigation config + content extraction, isolated in their own
// fixture so they don't perturb the primary index above.
describe("buildIndex edge cases", () => {
  let edgeDir: string;
  let edge: ContentIndex;

  beforeAll(async () => {
    edgeDir = await mkdtemp(join(tmpdir(), "undocs-edge-"));
    // `/blog/*` is excluded from `order`, but sibling paths that merely share
    // the "/blog" prefix (e.g. `/blogging`) must NOT be.
    await mkdir(join(edgeDir, "blog"), { recursive: true });
    await writeFile(join(edgeDir, "blog", "1.index.md"), "# Blog\n\nPosts.\n");
    await writeFile(join(edgeDir, "blog", "2.post.md"), "# Post\n\nA post.\n");
    await writeFile(join(edgeDir, "blogging.md"), "# Blogging\n\nAbout blogging.\n");
    // A `.navigation.yml` that tries to inject structural keys must not corrupt
    // the tree — only display fields survive.
    await mkdir(join(edgeDir, "docs"), { recursive: true });
    await writeFile(
      join(edgeDir, "docs", ".navigation.yml"),
      "title: Docs Section\nicon: i-section\nchildren: [{ title: Injected, path: /evil }]\npage: true\nbadge: Beta\n",
    );
    // The index page carries its own title (h1) + icon; the directory config
    // above sets a different title/icon for the SECTION. The self-index child in
    // the nav tree must keep the PAGE's title/icon, not the directory override.
    await writeFile(
      join(edgeDir, "docs", "1.index.md"),
      "---\nicon: i-page\n---\n\n# Docs\n\nDocs home.\n",
    );
    await writeFile(join(edgeDir, "docs", "2.deep.md"), "# Deep\n\nDeep page.\n");
    // An index-LESS subdirectory: it has a `.navigation.yml` title but no
    // `index.md`, so the group borrows its path from the first child. That first
    // child (which ends up sharing the group's path) must stay in the tree.
    await mkdir(join(edgeDir, "docs", "api"), { recursive: true });
    await writeFile(join(edgeDir, "docs", "api", ".navigation.yml"), "title: API\n");
    await writeFile(join(edgeDir, "docs", "api", "1.first.md"), "# First\n\nFirst page.\n");
    await writeFile(join(edgeDir, "docs", "api", "2.second.md"), "# Second\n\nSecond page.\n");
    // A leading GitHub alert must not be adopted as the page description.
    await writeFile(
      join(edgeDir, "alert.md"),
      "# Alert Page\n\n> [!NOTE]\n> Heads up.\n\nReal body.\n",
    );
    // The unjs README shape: automd markers wrapping a badge row, ahead of the
    // h1. Comments and the (text-free) badge paragraph must not hide it.
    await writeFile(
      join(edgeDir, "badged.md"),
      "<!-- automd:badges -->\n\n[![npm version](https://img/v)](https://npm/pkg)\n\n<!-- /automd -->\n\n# Badged Page\n\n> The badged description.\n\nReal body.\n",
    );
    // The other README shape: a raw `<div align="center">` header block.
    await writeFile(
      join(edgeDir, "centered.md"),
      '<div align="center">\n  <img src="/logo.svg">\n</div>\n\n# Centered Page\n\n> The centered description.\n\nReal body.\n',
    );
    // Frontmatter title differing from the h1: the h1 is NOT consumed by the
    // page header, so it stays in the body — and the description blockquote sits
    // behind it rather than at the first probe slot.
    await writeFile(
      join(edgeDir, "retitled.md"),
      "---\ntitle: Different\n---\n\n# H1 Here\n\n> Should be description.\n\nReal body.\n",
    );
    // Same shape, but the blockquote is a GitHub alert — still not a description.
    await writeFile(
      join(edgeDir, "retitled-alert.md"),
      "---\ntitle: Different\n---\n\n# H1 Here\n\n> [!NOTE]\n> Heads up.\n\nReal body.\n",
    );
    edge = await buildIndex({ dir: edgeDir });
  }, 60_000);

  afterAll(async () => {
    if (edgeDir) await rm(edgeDir, { recursive: true, force: true });
  });

  it("excludes /blog and /blog/* from order but keeps /blogging", () => {
    expect(edge.order).toContain("/blogging");
    expect(edge.order).not.toContain("/blog");
    expect(edge.order).not.toContain("/blog/post");
  });

  it("ignores structural keys injected via .navigation.yml", () => {
    const docs = edge.navigation.find((n) => n.path === "/docs")!;
    expect(docs).toBeDefined();
    // Display fields survive...
    expect(docs.title).toBe("Docs Section");
    expect(docs.badge).toBe("Beta");
    // ...but the injected `children`/`page` do not corrupt the real tree.
    expect(docs.children?.some((c) => c.path === "/evil")).toBe(false);
    expect(docs.children?.some((c) => c.path === "/docs/deep")).toBe(true);
  });

  it("does not adopt a leading GitHub alert as the page description", () => {
    const alert = edge.byPath.get("/alert")!;
    expect(alert.description).toBe("");
  });

  it("finds the h1/blockquote past a leading comment, badge row or raw HTML block", () => {
    // Reading `body[0]` only, each of these pages fell back to `titleCase(name)`
    // with an empty description — and kept the h1 in the body, so it rendered
    // again under the page header.
    const hasH1 = (p: (typeof edge.pages)[number]) =>
      p.body.value.some((n) => Array.isArray(n) && n[0] === "h1");

    const badged = edge.byPath.get("/badged")!;
    expect(badged.title).toBe("Badged Page");
    expect(badged.description).toBe("The badged description.");
    expect(hasH1(badged)).toBe(false);

    const centered = edge.byPath.get("/centered")!;
    expect(centered.title).toBe("Centered Page");
    expect(centered.description).toBe("The centered description.");
    expect(hasH1(centered)).toBe(false);
  });

  it("still takes the description blockquote when a frontmatter title kept the h1 in the body", () => {
    // The h1 is only spliced out when its text IS the resolved title, so with a
    // differing frontmatter title it stays — and the probe, which looked at the
    // first probe-eligible node, found that h1 instead of the blockquote and
    // dropped the description entirely.
    const retitled = edge.byPath.get("/retitled")!;
    expect(retitled.title).toBe("Different");
    expect(retitled.description).toBe("Should be description.");
    // The h1 was not consumed by the page header, so it must still render...
    expect(retitled.body.value.some((n) => Array.isArray(n) && n[0] === "h1")).toBe(true);
    // ...while the consumed blockquote is gone from the body.
    expect(retitled.body.value.some((n) => Array.isArray(n) && n[0] === "blockquote")).toBe(false);

    // A GitHub alert in that position is still a callout, not a description.
    const alert = edge.byPath.get("/retitled-alert")!;
    expect(alert.description).toBe("");
    expect(alert.body.value.some((n) => Array.isArray(n) && n[0] === "h1")).toBe(true);
  });

  it("keeps the index page's own title/icon on the self-index child, not the directory override", () => {
    const docs = edge.navigation.find((n) => n.path === "/docs")!;
    // Section header reflects the `.navigation.yml` override...
    expect(docs.title).toBe("Docs Section");
    expect(docs.icon).toBe("i-section");
    // ...but its re-added index child shows the PAGE's own title/icon, so it
    // doesn't just duplicate the section label.
    const indexChild = docs.children?.find((c) => c.path === "/docs");
    expect(indexChild?.title).toBe("Docs");
    expect(indexChild?.icon).toBe("i-page");
  });

  it("marks a section whose title came from .navigation.yml", () => {
    // `mobileNavLinks` re-derives a section's title from its directory to stop a
    // drawer header repeating its index child — which it must not do when the
    // author named the section. Only the builder can still tell the two apart.
    const docs = edge.navigation.find((n) => n.path === "/docs")!;
    expect(docs.titleFromConfig).toBe(true);
    // Not on the re-added index child, whose title is the PAGE's.
    expect(docs.children?.find((c) => c.path === "/docs")?.titleFromConfig).toBeUndefined();
    // Nor on titles the builder derived itself.
    expect(docs.children?.find((c) => c.path === "/docs/deep")?.titleFromConfig).toBeUndefined();
    expect(edge.navigation.find((n) => n.path === "/blog")?.titleFromConfig).toBeUndefined();
  });

  it("builds an index-less directory into a page-less group keyed by its first child", () => {
    const docs = edge.navigation.find((n) => n.path === "/docs")!;
    const api = docs.children?.find((c) => c.title === "API");
    expect(api).toBeDefined();
    // No index.md → the group is not itself a page; its path is borrowed from
    // the first child.
    expect(api?.page).toBe(false);
    expect(api?.path).toBe("/docs/api/first");
    // The first child shares the group's path but must NOT be folded away — every
    // page in the directory stays in the tree.
    expect(api?.children?.map((c) => c.path)).toEqual(["/docs/api/first", "/docs/api/second"]);
  });
});

// The docs root's position in the content order. Its own fixture because the
// point is a docs set whose files carry NO numeric prefixes.
describe("buildIndex root ordering", () => {
  let flatDir: string;
  let numberedDir: string;

  afterAll(async () => {
    for (const d of [flatDir, numberedDir]) {
      if (d) await rm(d, { recursive: true, force: true });
    }
  });

  it("leads with an unprefixed root index.md rather than sorting it alphabetically", async () => {
    flatDir = await mkdtemp(join(tmpdir(), "undocs-flat-"));
    // Alphabetically `another.md` < `index.md`, so a plain `orderKey` sort would
    // list the docs' front page second — in the nav AND in prev/next.
    await writeFile(join(flatDir, "index.md"), "# Home\n\nIntro.\n");
    await writeFile(join(flatDir, "another.md"), "# Another\n\nMore.\n");
    const flat = await buildIndex({ dir: flatDir });

    expect(flat.order).toEqual(["/", "/another"]);
    expect(flat.navigation.map((n) => n.path)).toEqual(["/", "/another"]);
    expect(flat.navigation[0].root).toBe(true);
  });

  it("keeps an explicit number on the root index.md", async () => {
    numberedDir = await mkdtemp(join(tmpdir(), "undocs-numbered-"));
    // Numbering a file IS the ordering choice, so it is not overridden.
    await writeFile(join(numberedDir, "9.index.md"), "# Home\n\nIntro.\n");
    await writeFile(join(numberedDir, "1.another.md"), "# Another\n\nMore.\n");
    const numbered = await buildIndex({ dir: numberedDir });

    expect(numbered.order).toEqual(["/another", "/"]);
    expect(numbered.navigation.map((n) => n.path)).toEqual(["/another", "/"]);
  });
});

// `README.md` is an alias for `index.md`, so a docs set that reads well browsed
// on GitHub builds without being renamed.
describe("buildIndex README alias", () => {
  let readmeDir: string;
  let bothDir: string;

  afterAll(async () => {
    for (const d of [readmeDir, bothDir]) {
      if (d) await rm(d, { recursive: true, force: true });
    }
  });

  it("routes README.md exactly as index.md, at the root and in a section", async () => {
    readmeDir = await mkdtemp(join(tmpdir(), "undocs-readme-"));
    await writeFile(join(readmeDir, "README.md"), "# Home\n\n> The front page\n\nIntro.\n");
    await mkdir(join(readmeDir, "1.guide"), { recursive: true });
    await writeFile(join(readmeDir, "1.guide", "README.md"), "# Guide\n\nOverview.\n");
    await writeFile(join(readmeDir, "1.guide", "2.usage.md"), "# Usage\n\nHow to.\n");
    const index = await buildIndex({ dir: readmeDir });

    expect(index.pages.map((p) => p.path)).toEqual(["/", "/guide", "/guide/usage"]);
    expect(index.byPath.get("/")?.title).toBe("Home");
    expect(index.byPath.get("/")?.description).toBe("The front page");

    // The unprefixed docs root still leads (`scanKey`), and is flagged `root`.
    expect(index.order).toEqual(["/", "/guide", "/guide/usage"]);
    expect(index.navigation[0]).toMatchObject({ path: "/", root: true });

    // A section README is its directory's index, so the section keeps its own
    // identity and re-emits that page as its first child.
    const guide = index.navigation.find((n) => n.path === "/guide")!;
    expect(guide.children?.map((c) => c.path)).toEqual(["/guide", "/guide/usage"]);
  });

  it("lets an explicit index.md win over a README.md in the same directory", async () => {
    bothDir = await mkdtemp(join(tmpdir(), "undocs-both-"));
    await writeFile(join(bothDir, "index.md"), "# Real Home\n\nThe docs.\n");
    await writeFile(join(bothDir, "README.md"), "# Repo Stub\n\nSee the docs site.\n");
    const index = await buildIndex({ dir: bothDir });

    // One page on the route, and it is the index — not whichever sorted first.
    expect(index.pages).toHaveLength(1);
    expect(index.byPath.get("/")?.title).toBe("Real Home");
  });
});

// The generalisation behind the README fix: an index page leads its OWN
// directory, at any depth, whether it is spelled `index` or `README`.
describe("buildIndex unnumbered index ordering", () => {
  let deepDir: string;

  afterAll(async () => {
    if (deepDir) await rm(deepDir, { recursive: true, force: true });
  });

  it("puts an unnumbered section index ahead of its numbered siblings", async () => {
    deepDir = await mkdtemp(join(tmpdir(), "undocs-deep-"));
    await mkdir(join(deepDir, "1.guide"), { recursive: true });
    // `orderKey` alone keys these "000001.guide/999999index.md" and
    // "000001.guide/000002.usage.md", so the section's own page would sort
    // after the page inside it.
    await writeFile(join(deepDir, "1.guide", "index.md"), "# Guide\n\nOverview.\n");
    await writeFile(join(deepDir, "1.guide", "2.usage.md"), "# Usage\n\nHow to.\n");
    await mkdir(join(deepDir, "2.api"), { recursive: true });
    await writeFile(join(deepDir, "2.api", "README.md"), "# API\n\nReference.\n");
    await writeFile(join(deepDir, "2.api", "1.types.md"), "# Types\n\nTypes.\n");
    const index = await buildIndex({ dir: deepDir });

    expect(index.order).toEqual(["/guide", "/guide/usage", "/api", "/api/types"]);
  });
});

// Two different files can resolve to ONE route (`guide.md` beside
// `guide/index.md`, `index.md` beside `1.index.md`). Building both corrupts
// `byPath` (last writer wins, the other page unreachable), `order` (the route
// listed twice, so prev/next lands on the page itself) and the nav tree (two
// items on one path) — all without a diagnostic.
describe("buildIndex duplicate routes", () => {
  let dupDir: string;
  let dup: ContentIndex;
  let warnings: string[];

  beforeAll(async () => {
    dupDir = await mkdtemp(join(tmpdir(), "undocs-dup-"));
    // Root: unnumbered vs numbered index, both `/`.
    await writeFile(join(dupDir, "index.md"), "# Home\n\nIntro.\n");
    await writeFile(join(dupDir, "1.index.md"), "# Numbered Home\n\nDupe.\n");
    // Section: flat page vs directory index, both `/guide`.
    await writeFile(join(dupDir, "guide.md"), "# Flat Guide\n\nA.\n");
    await mkdir(join(dupDir, "guide"), { recursive: true });
    await writeFile(join(dupDir, "guide", "index.md"), "# Dir Guide\n\nB.\n");
    await writeFile(join(dupDir, "guide", "usage.md"), "# Usage\n\nC.\n");

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      dup = await buildIndex({ dir: dupDir });
      warnings = warn.mock.calls.map((c) => String(c[0]));
    } finally {
      warn.mockRestore();
    }
  }, 60_000);

  afterAll(async () => {
    if (dupDir) await rm(dupDir, { recursive: true, force: true });
  });

  it("builds one page per route", () => {
    expect(dup.pages.map((p) => p.path)).toEqual(["/", "/guide", "/guide/usage"]);
    expect(dup.byPath.size).toBe(dup.pages.length);
    // The winner is the file that comes first in the walk, not whichever the
    // filesystem happened to hand back last.
    expect(dup.byPath.get("/")?.rel).toBe("index.md");
    expect(dup.byPath.get("/guide")?.rel).toBe("guide.md");
  });

  it("leaves no duplicate entries in `order` (prev/next would point at the page itself)", () => {
    expect(dup.order).toEqual(["/", "/guide", "/guide/usage"]);
    expect(new Set(dup.order).size).toBe(dup.order.length);
    // `[...path].get.ts` derives the surround with `order.indexOf(page.path)`.
    for (const p of dup.pages) {
      expect(dup.order[dup.order.indexOf(p.path) + 1]).not.toBe(p.path);
    }
  });

  it("keeps the nav tree free of duplicate paths", () => {
    const paths = (items: typeof dup.navigation): string[] =>
      items.flatMap((n) => [n.path!, ...paths(n.children || [])]);
    expect(dup.navigation.filter((n) => n.path === "/")).toHaveLength(1);
    const all = paths(dup.navigation);
    expect(new Set(all).size).toBe(all.length);
  });

  it("warns naming both source files", () => {
    const forRoot = warnings.find((w) => w.includes("duplicate route /:"))!;
    expect(forRoot).toContain("index.md");
    expect(forRoot).toContain("1.index.md");
    const forGuide = warnings.find((w) => w.includes("duplicate route /guide:"))!;
    expect(forGuide).toContain("guide.md");
    expect(forGuide).toContain("guide/index.md");
  });
});

// Two sections may legitimately carry the same number (a docs set numbering
// only SOME of its directories, or an author who copied a prefix). The sort key
// has to keep them apart, or the walk interleaves them.
describe("buildIndex same-numbered siblings", () => {
  let sameDir: string;

  afterAll(async () => {
    if (sameDir) await rm(sameDir, { recursive: true, force: true });
  });

  it("keeps each section's pages contiguous when two directories share a number", async () => {
    sameDir = await mkdtemp(join(tmpdir(), "undocs-same-"));
    for (const [seg, pages] of [
      ["1.guide", ["1.install", "2.usage"]],
      ["1.api", ["1.core", "2.plugins"]],
    ] as const) {
      await mkdir(join(sameDir, seg), { recursive: true });
      await writeFile(join(sameDir, seg, "index.md"), `# ${seg}\n\nOverview.\n`);
      for (const p of pages) {
        await writeFile(join(sameDir, seg, `${p}.md`), `# ${p}\n\nBody.\n`);
      }
    }
    await writeFile(join(sameDir, "index.md"), "# Home\n\nIntro.\n");
    const index = await buildIndex({ dir: sameDir });

    // Ties break on the segment NAME, so `api` leads `guide` — and neither
    // section's pages appear inside the other's run (prev/next would bounce).
    expect(index.order).toEqual([
      "/",
      "/api",
      "/api/core",
      "/api/plugins",
      "/guide",
      "/guide/install",
      "/guide/usage",
    ]);
  });

  it("orders two same-numbered files in one directory by name, not by readdir", async () => {
    const dir2 = await mkdtemp(join(tmpdir(), "undocs-samefile-"));
    await writeFile(join(dir2, "1.beta.md"), "# Beta\n\nB.\n");
    await writeFile(join(dir2, "1.alpha.md"), "# Alpha\n\nA.\n");
    const index = await buildIndex({ dir: dir2 });

    expect(index.order).toEqual(["/alpha", "/beta"]);
    await rm(dir2, { recursive: true, force: true });
  });
});

// The TOC is built HERE, on the server; the ids are emitted by the client
// renderer (`src/app/content/MarkdownRenderer.ts`) during SSR and hydration. The
// two must agree exactly, or every TOC link points at nothing — so the id is
// allocated once and stamped onto the heading node, and these tests assert the
// node and the TOC link carry the same string.
describe("buildIndex heading anchors", () => {
  let anchorDir: string;
  let index: ContentIndex;

  beforeAll(async () => {
    anchorDir = await mkdtemp(join(tmpdir(), "undocs-anchors-"));
    await writeFile(
      join(anchorDir, "index.md"),
      [
        "# Начало",
        "",
        "## Установка",
        "",
        "Ставим.",
        "",
        "### Options",
        "",
        "Первые опции.",
        "",
        "## 安装",
        "",
        "装好了。",
        "",
        "### Options",
        "",
        "Вторые опции.",
        "",
        "## Émoji 🚀 heading",
        "",
        "Accented.",
        "",
        "## 🚀",
        "",
        "Nothing sluggable.",
        "",
      ].join("\n"),
    );
    index = await buildIndex({ dir: anchorDir });
  }, 60_000);

  afterAll(async () => {
    if (anchorDir) await rm(anchorDir, { recursive: true, force: true });
  });

  const headings = (nodes: any[]): any[] => {
    const out: any[] = [];
    const visit = (list: any[]) => {
      for (const n of list) {
        if (!Array.isArray(n) || typeof n[0] !== "string") continue;
        if (/^h[1-6]$/.test(n[0])) out.push(n);
        visit(n.slice(2));
      }
    };
    visit(nodes);
    return out;
  };

  const flatToc = (links: any[]): any[] =>
    links.flatMap((l) => [l, ...(l.children ? flatToc(l.children) : [])]);

  it("slugs non-Latin headings instead of emptying them", () => {
    const toc = flatToc(index.byPath.get("/")!.body.toc.links);
    expect(toc.map((l) => l.id)).toEqual([
      "установка",
      "options",
      "安装",
      "options-2",
      "émoji-heading",
      "section",
    ]);
  });

  it("gives two identically-named headings distinct ids", () => {
    const toc = flatToc(index.byPath.get("/")!.body.toc.links);
    const options = toc.filter((l) => l.text === "Options");
    expect(options).toHaveLength(2);
    expect(options[0].id).not.toBe(options[1].id);
  });

  // The renderer uses `props.id` verbatim when it is set, so a non-empty id on
  // every heading node IS the rendered `id` — and its `slugify` fallback (which
  // could neither de-duplicate nor see the rest of the page) never runs.
  it("stamps the same id on the heading node the renderer will render", () => {
    const page = index.byPath.get("/")!;
    const nodes = headings(page.body.value);
    const ids = nodes.map((n) => n[1].id);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    // Every TOC link resolves to exactly one heading node, carrying its text.
    for (const link of flatToc(page.body.toc.links)) {
      const matches = nodes.filter((n) => n[1].id === link.id);
      expect(matches).toHaveLength(1);
      expect(matches[0][1].id).toBe(link.id);
    }
  });

  it("keys the search sections by the same id", () => {
    const ids = index.search.filter((s) => s.level > 1).map((s) => s.id);
    expect(ids).toContain("/#options");
    expect(ids).toContain("/#options-2");
    expect(ids).toContain("/#установка");
    // Each heading section carries its OWN prose — the proof the second
    // `### Options` is not silently folded into the first.
    const first = index.search.find((s) => s.id === "/#options");
    const second = index.search.find((s) => s.id === "/#options-2");
    expect(first!.content).toContain("Первые");
    expect(second!.content).toContain("Вторые");
  });
});
