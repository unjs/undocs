import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { useRuntimeConfig } from "nitro/runtime-config";
import { getDocsDir, getIndex, invalidateIndex } from "../../src/server/content/store.ts";
import { loadDocsConfig } from "../../src/server/docs-config.ts";
import { applyBuildOptionsPlugins } from "../../src/server/plugins/apply.ts";
import { getPluginRuntime, resetPluginRuntimeCache } from "../../src/server/plugins/runtime.ts";

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
  resetPluginRuntimeCache();
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

  it("applies plugin buildOptions before indexing", async () => {
    const echoDir = fileURLToPath(new URL("../fixtures/plugins/echo", import.meta.url));
    const pluginDir = await mkdtemp(join(tmpdir(), "undocs-store-plugin-"));
    await writeFile(join(pluginDir, "index.md"), "# Home\n\nHi.\n");
    await mkdir(join(pluginDir, ".config"), { recursive: true });
    await writeFile(
      join(pluginDir, ".config/docs.yaml"),
      `plugins:\n  - ${JSON.stringify(echoDir)}\n`,
    );
    (useRuntimeConfig() as any).undocs = { dir: pluginDir };
    resetPluginRuntimeCache();
    invalidateIndex();

    const docsConfig = await loadDocsConfig(pluginDir);
    const pluginRuntime = await getPluginRuntime(pluginDir, docsConfig);
    expect(pluginRuntime.plugins).toHaveLength(1);
    const buildOpts = applyBuildOptionsPlugins(
      { dir: pluginDir, automd: undefined, pluginRuntime },
      pluginRuntime.plugins,
      pluginRuntime.ctx,
    );
    expect(buildOpts.automd).toBe("echo-marker");

    const index = await getIndex();
    expect(index.byPath.get("/")?.title).toBe("Home");

    resetPluginRuntimeCache();
    invalidateIndex();
    (useRuntimeConfig() as any).undocs = { dir };
    await rm(pluginDir, { recursive: true, force: true });
  });
});
