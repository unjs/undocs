import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import MiniSearch from "minisearch";
import { buildIndex } from "../../src/server/content/builder";
import {
  MINISEARCH_OPTIONS,
  MINISEARCH_SEARCH_OPTIONS,
} from "../../src/server/content/search-options";
import type { ContentIndex } from "../../src/server/content/types";

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
