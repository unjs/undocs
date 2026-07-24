import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useRuntimeConfig } from "nitro/runtime-config";
import { getDocsDir, getIndex, invalidateIndex } from "../../src/server/content/store";

// `store.ts` reads the docs dir from Nitro's runtime config. Outside a Nitro
// build, `useRuntimeConfig()` returns a cached stub object; seed `undocs.dir` on
// it (same reference the store sees) so no module mocking is needed.
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "undocs-store-"));
  await writeFile(join(dir, "index.md"), "# Home\n\nHi.\n");
  (useRuntimeConfig() as any).undocs = { dir };
});

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe("getDocsDir", () => {
  it("returns the configured docs dir", () => {
    expect(getDocsDir()).toBe(dir);
  });
});

describe("getIndex / invalidateIndex", () => {
  it("builds an index from the configured dir", async () => {
    const index = await getIndex();
    expect(index.byPath.get("/")?.title).toBe("Home");
  });

  it("memoizes the built index (same promise on repeat calls)", () => {
    const a = getIndex();
    const b = getIndex();
    expect(a).toBe(b);
  });

  it("invalidateIndex() clears the cache so the next call rebuilds", () => {
    const before = getIndex();
    invalidateIndex();
    const after = getIndex();
    expect(after).not.toBe(before);
  });
});
