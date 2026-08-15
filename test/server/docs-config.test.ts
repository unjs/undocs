import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDocsConfig } from "../../src/server/docs-config.ts";

// Each case gets its own tree under one temp root. The root itself carries a
// `.git` dir so the upward walk can never escape into the real filesystem (and
// pick up undocs' own package.json).
let root: string;

const docsDirFor = async (name: string, files: Record<string, string>): Promise<string> => {
  const base = join(root, name);
  for (const [rel, content] of Object.entries(files)) {
    const path = join(base, rel);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, content);
  }
  await mkdir(join(base, ".git"), { recursive: true });
  return join(base, "docs");
};

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "undocs-docs-config-"));
});

afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe("loadDocsConfig", () => {
  it("keeps explicit values", async () => {
    const dir = await docsDirFor("explicit", {
      "package.json": JSON.stringify({ name: "my-pkg", description: "pkg desc" }),
      "docs/.config/docs.json": JSON.stringify({ name: "My Docs", description: "docs desc" }),
    });
    const config = await loadDocsConfig(dir);
    expect(config.name).toBe("My Docs");
    expect(config.description).toBe("docs desc");
  });

  it("infers name and description from the closest package.json", async () => {
    const dir = await docsDirFor("inferred", {
      "package.json": JSON.stringify({ name: "@scope/my-pkg", description: "pkg desc" }),
      "docs/.config/docs.json": "{}",
    });
    const config = await loadDocsConfig(dir);
    expect(config.name).toBe("@scope/my-pkg");
    expect(config.description).toBe("pkg desc");
  });

  it("infers only what the config omits", async () => {
    const dir = await docsDirFor("partial", {
      "package.json": JSON.stringify({ name: "my-pkg", description: "pkg desc" }),
      "docs/.config/docs.json": JSON.stringify({ name: "My Docs" }),
    });
    const config = await loadDocsConfig(dir);
    expect(config.name).toBe("My Docs");
    expect(config.description).toBe("pkg desc");
  });

  it("prefers the nearest package.json over an ancestor", async () => {
    const dir = await docsDirFor("nearest", {
      "package.json": JSON.stringify({ name: "root-pkg", description: "root desc" }),
      "docs/package.json": JSON.stringify({ name: "docs-pkg", description: "docs pkg desc" }),
      "docs/.config/docs.json": "{}",
    });
    const config = await loadDocsConfig(dir);
    expect(config.name).toBe("docs-pkg");
    expect(config.description).toBe("docs pkg desc");
  });

  it("resolves each field independently while walking up", async () => {
    const dir = await docsDirFor("mixed", {
      "package.json": JSON.stringify({ name: "root-pkg", description: "root desc" }),
      "docs/package.json": JSON.stringify({ name: "docs-pkg" }),
      "docs/.config/docs.json": "{}",
    });
    const config = await loadDocsConfig(dir);
    expect(config.name).toBe("docs-pkg");
    expect(config.description).toBe("root desc");
  });

  it("stops at the repository root", async () => {
    const dir = await docsDirFor("no-package", { "docs/.config/docs.json": "{}" });
    const config = await loadDocsConfig(dir);
    expect(config.name).toBe("");
    expect(config.description).toBe("");
  });
});
