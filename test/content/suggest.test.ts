import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIndex } from "../../src/server/content/builder.ts";
import { normalizeGuess, similarity, suggestPages } from "../../src/server/content/suggest.ts";
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

  it("does not mistake a shared parent for a typo", () => {
    // As whole paths these are 87% alike — all of it the `/api/utils/` prefix.
    expect(suggestPages(index, "/api/utils/hash").redirect).toBeUndefined();
  });

  it("redirects when the strict search lands on one page, to the matched section", () => {
    expect(suggestPages(index, "/hosting/zeitplatform").redirect).toBe("/guide/deploy#vercel");
  });

  it("falls back to a deduplicated results list", () => {
    const { redirect, results } = suggestPages(index, "/nothing-like-it");
    expect(redirect).toBeUndefined();
    expect(new Set(results.map((r) => r.path)).size).toBe(results.length);
  });

  it("only ever redirects to a page that exists", () => {
    for (const guess of ["/x", "/guide/x", "/api", "/guide/deployment", "/install"]) {
      const { redirect } = suggestPages(index, guess);
      if (redirect) expect(index.byPath.has(redirect.split("#")[0]!), guess).toBe(true);
    }
  });
});
