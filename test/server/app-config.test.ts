import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateAppConfig } from "../../src/server/app-config.ts";

let root: string;

const docsDirFor = async (name: string, config: unknown): Promise<string> => {
  const base = join(root, name);
  await mkdir(join(base, "docs", ".config"), { recursive: true });
  await mkdir(join(base, ".git"), { recursive: true });
  await writeFile(join(base, "docs", ".config", "docs.json"), JSON.stringify(config));
  return join(base, "docs");
};

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "undocs-app-config-"));
});

afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe("generateAppConfig footer.notes", () => {
  it("renders each note to inline HTML", async () => {
    const dir = await docsDirFor("notes-list", {
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

  it("accepts a single string and drops blank entries", async () => {
    const dir = await docsDirFor("notes-string", {
      name: "Docs",
      footer: { notes: "  Apache-2.0  " },
    });
    const { docs } = await generateAppConfig(dir);
    expect(docs.footer.notes).toEqual(["<p>Apache-2.0</p>\n"]);

    const blank = await docsDirFor("notes-blank", { name: "Docs", footer: { notes: ["", "  "] } });
    expect((await generateAppConfig(blank)).docs.footer.notes).toBeUndefined();
  });

  it("leaves the config alone without notes", async () => {
    const dir = await docsDirFor("no-notes", { name: "Docs" });
    const { docs } = await generateAppConfig(dir);
    expect(docs.footer).toBeUndefined();
  });
});
