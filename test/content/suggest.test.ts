import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIndex } from "../../src/server/content/builder.ts";
import {
  normalizeGuess,
  notFoundMarkdown,
  similarity,
  suggestPages,
} from "../../src/server/content/suggest.ts";
import type { ContentIndex } from "../../src/server/content/types.ts";

// The 404's second chance. Each tier is pinned on BOTH sides: a guess it should
// redirect, and a near-identical one where two pages tie and it must not.
let dir: string;
let index: ContentIndex;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "undocs-suggest-"));
  await writeFile(join(dir, "1.index.md"), "# Home\n\nWelcome.\n");
  await mkdir(join(dir, "1.guide"), { recursive: true });
  await writeFile(join(dir, "1.guide", "1.index.md"), "# Guide\n\nOverview.\n");
  await writeFile(
    join(dir, "1.guide", "2.getting-started.md"),
    "# Getting Started\n\n> First steps\n\nInstall the package.\n",
  );
  await writeFile(
    join(dir, "1.guide", "3.deploy.md"),
    "# Deploy\n\nShip it.\n\n## Vercel\n\nZero config on zeitplatform.\n",
  );
  await writeFile(join(dir, "1.guide", "4.config.md"), "# Config\n\nGuide config.\n");
  await mkdir(join(dir, "2.api"), { recursive: true });
  await writeFile(join(dir, "2.api", "1.config.md"), "# Config API\n\nThe config API.\n");
  await writeFile(join(dir, "2.api", "2.storage.md"), "# Storage\n\nKey-value storage.\n");
  await mkdir(join(dir, "2.api", "3.utils"), { recursive: true });
  await writeFile(join(dir, "2.api", "3.utils", "1.path.md"), "# Path\n\nJoin segments.\n");
  // Two pages one respelling apart: a tie for tier 1.
  await writeFile(join(dir, "2.api", "4.key_value.md"), "# Key Value\n\nUnderscored.\n");
  await writeFile(join(dir, "2.api", "5.key-value.md"), "# Key-Value\n\nDashed.\n");
  await writeFile(join(dir, "2.api", "6.hooks.md"), "# Hooks\n\nLifecycle.\n");
  await writeFile(join(dir, "2.api", "7.Getting Help.md"), "# Getting Help\n\nAsk.\n");
  index = await buildIndex({ dir });
}, 60_000);

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe("normalizeGuess", () => {
  it("strips the spelling noise agents add", () => {
    expect(normalizeGuess("/Guide/Deploy/")).toBe("/guide/deploy");
    expect(normalizeGuess("/1.guide/3.deploy.md")).toBe("/guide/deploy");
    expect(normalizeGuess("/guide/deploy.html")).toBe("/guide/deploy");
    expect(normalizeGuess("/guide/index")).toBe("/guide");
    expect(normalizeGuess("/guide/getting_started")).toBe("/guide/getting-started");
    expect(normalizeGuess("/guide/getting%20started")).toBe("/guide/getting-started");
  });
});

describe("similarity", () => {
  it("charges a transposition once", () => {
    expect(similarity("deploy", "deploy")).toBe(1);
    expect(similarity("deplyo", "deploy")).toBeCloseTo(5 / 6);
  });
});

describe("suggestPages", () => {
  it("refuses a respelling two pages share", () => {
    const { redirect, results } = suggestPages(index, "/api/Key_Value");
    expect(redirect).toBeUndefined();
    expect(results.map((r) => r.path)).toEqual(
      expect.arrayContaining(["/api/key_value", "/api/key-value"]),
    );
  });

  it("hands the redirect out URI-encoded", () => {
    // A page path is its filename; a `Location` header must be ASCII.
    expect(suggestPages(index, "/getting help").redirect).toBe("/api/Getting%20Help");
    expect(suggestPages(index, "/api/getting%20help").redirect).toBe("/api/Getting%20Help");
  });

  it("redirects a respelling of a real path", () => {
    expect(suggestPages(index, "/1.guide/3.deploy").redirect).toBe("/guide/deploy");
    expect(suggestPages(index, "/guide/deploy.html").redirect).toBe("/guide/deploy");
    expect(suggestPages(index, "/docs/guide/deploy").redirect).toBe("/guide/deploy");
    expect(suggestPages(index, "/docs").redirect).toBe("/");
  });

  it("redirects a last segment exactly one page shares", () => {
    expect(suggestPages(index, "/deploy").redirect).toBe("/guide/deploy");
    expect(suggestPages(index, "/reference/storage").redirect).toBe("/api/storage");
  });

  it("lists rather than guesses when the last segment is shared", () => {
    const { redirect, results } = suggestPages(index, "/config");
    expect(redirect).toBeUndefined();
    expect(results.map((r) => r.path).slice(0, 2)).toEqual(
      expect.arrayContaining(["/guide/config", "/api/config"]),
    );
  });

  it("redirects a typo of a slug", () => {
    expect(suggestPages(index, "/guide/getting-stared").redirect).toBe("/guide/getting-started");
    expect(suggestPages(index, "/guide/deplyo").redirect).toBe("/guide/deploy");
    expect(suggestPages(index, "/storages").redirect).toBe("/api/storage");
  });

  it("does not call one letter in five a typo", () => {
    expect(suggestPages(index, "/books").redirect).toBeUndefined();
  });

  it("does not mistake a shared parent for a typo", () => {
    // As whole paths these are 87% alike — all of it the `/api/utils/` prefix.
    expect(suggestPages(index, "/api/utils/hash").redirect).toBeUndefined();
  });

  it("redirects when a title on one page matches, to the matched section", () => {
    expect(suggestPages(index, "/hosting/vercel").redirect).toBe("/guide/deploy#vercel");
  });

  it("never redirects on a word only the body text mentions", () => {
    const { redirect, results } = suggestPages(index, "/zeitplatform");
    expect(redirect).toBeUndefined();
    expect(results.map((r) => r.path)).toContain("/guide/deploy");
  });

  it("bounds the work an oversized guess can cause", () => {
    const start = performance.now();
    expect(suggestPages(index, `/${"a".repeat(16_000)}`)).toEqual({ results: [] });
    const many = suggestPages(
      index,
      `/${Array.from({ length: 2000 }, (_, i) => `w${i}`).join("/")}`,
    );
    expect(many.redirect).toBeUndefined();
    expect(suggestPages(index, `/guide/${"x".repeat(200)}`).redirect).toBeUndefined();
    expect(performance.now() - start).toBeLessThan(500);
  });

  it("falls back to a deduplicated results list", () => {
    const { redirect, results } = suggestPages(index, "/nothing-like-it");
    expect(redirect).toBeUndefined();
    expect(new Set(results.map((r) => r.path)).size).toBe(results.length);
  });

  it("renders the markdown 404 as short, fetchable rows", () => {
    const md = notFoundMarkdown("/nope", {
      results: [
        {
          path: "/guide/deploy",
          hash: "#vercel",
          title: "Vercel",
          breadcrumb: "Deploy",
          preview: "Zero config. More text after the first sentence.",
        },
        { path: "/api/Getting Help", title: "Getting [Help]", preview: `${"word ".repeat(40)}` },
      ],
    });
    // A section names its page; `/raw` serves the whole page, so no anchor.
    expect(md).toContain("- [Deploy › Vercel](</raw/guide/deploy.md>) — Zero config.\n");
    const help = md.split("\n").find((l) => l.includes("Getting"))!;
    expect(help).toMatch(
      /^- \[Getting \\\[Help\\\]\]\(<\/raw\/api\/Getting%20Help\.md>\) — (word )+word…$/,
    );
    expect(help.split(" — ")[1]!.length).toBeLessThanOrEqual(121);
    expect(notFoundMarkdown("/", { results: [] })).not.toContain("Closest");
  });

  it("only ever redirects to a page that exists", () => {
    for (const guess of ["/x", "/guide/x", "/api", "/guide/deployment", "/install"]) {
      const { redirect } = suggestPages(index, guess);
      if (redirect) expect(index.byPath.has(redirect.split("#")[0]!), guess).toBe(true);
    }
  });
});
