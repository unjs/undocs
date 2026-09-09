import { describe, it, expect, vi, type TestContext } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// One throwaway tree per test, removed when the test ends. The `.git` dir at
// its root stops the package.json walk at the fixture (see docs-config.test.ts).
const docsDirFor = async ({ onTestFinished }: TestContext, config: unknown): Promise<string> => {
  const base = await mkdtemp(join(tmpdir(), "undocs-app-config-"));
  onTestFinished(() => rm(base, { recursive: true, force: true }));
  await mkdir(join(base, "docs", ".config"), { recursive: true });
  await mkdir(join(base, ".git"), { recursive: true });
  await writeFile(join(base, "docs", ".config", "docs.json"), JSON.stringify(config));
  return join(base, "docs");
};

describe.concurrent("generateAppConfig footer.notes", async () => {
  const { generateAppConfig } = await import("../../src/server/app-config.ts");

  it("renders each note to HTML", async (ctx) => {
    const dir = await docsDirFor(ctx, {
      name: "Docs",
      footer: {
        notes: ["Released under [MIT](https://example.com/LICENSE).", "Hosted on **Example**."],
      },
    });
    const { docs } = await generateAppConfig(dir);
    expect(docs.footer.notes).toEqual([
      '<p>Released under <a href="https://example.com/LICENSE">MIT</a>.</p>\n',
      "<p>Hosted on <strong>Example</strong>.</p>\n",
    ]);
  });

  it("accepts a single string", async (ctx) => {
    const dir = await docsDirFor(ctx, { name: "Docs", footer: { notes: "  Apache-2.0  " } });
    const { docs } = await generateAppConfig(dir);
    expect(docs.footer.notes).toEqual(["<p>Apache-2.0</p>\n"]);
  });

  it("drops blank entries so the footer falls back", async (ctx) => {
    const dir = await docsDirFor(ctx, { name: "Docs", footer: { notes: ["", "  "] } });
    const { docs } = await generateAppConfig(dir);
    expect(docs.footer.notes).toBeUndefined();
  });

  it("leaves the config alone without notes", async (ctx) => {
    const dir = await docsDirFor(ctx, { name: "Docs" });
    const { docs } = await generateAppConfig(dir);
    expect(docs.footer).toBeUndefined();
  });
});

// Sequential: the mock swaps the module registry, so nothing above may be
// importing while it is in place.
describe("generateAppConfig without a markdown renderer", () => {
  const withoutRenderer = async ({ onTestFinished }: TestContext) => {
    vi.doMock("md4x/wasm", () => ({
      init: () => Promise.reject(new Error("no wasm here")),
      renderToHtml: () => {
        throw new Error("unreachable");
      },
    }));
    vi.resetModules();
    onTestFinished(() => {
      vi.doUnmock("md4x/wasm");
      vi.resetModules();
    });
    return (await import("../../src/server/app-config.ts")).generateAppConfig;
  };

  it("drops string notes so the footer falls back", async (ctx) => {
    const generateAppConfig = await withoutRenderer(ctx);
    const dir = await docsDirFor(ctx, { name: "Docs", footer: { notes: "Apache-2.0" } });
    const { docs } = await generateAppConfig(dir);
    expect(docs.footer.notes).toBeUndefined();
  });

  it("drops array notes so the footer falls back", async (ctx) => {
    const generateAppConfig = await withoutRenderer(ctx);
    const dir = await docsDirFor(ctx, { name: "Docs", footer: { notes: ["a", "b"] } });
    const { docs } = await generateAppConfig(dir);
    expect(docs.footer.notes).toBeUndefined();
  });

  it("leaves feature descriptions as written", async (ctx) => {
    const generateAppConfig = await withoutRenderer(ctx);
    const dir = await docsDirFor(ctx, {
      name: "Docs",
      landing: { features: [{ title: "t", description: "**bold**" }] },
    });
    const { docs } = await generateAppConfig(dir);
    expect(docs.landing.features[0].description).toBe("**bold**");
  });
});
