import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collectWatchDirs } from "@server/dev-watch";

// A docs dir shaped like a real project: content dirs plus the noise the
// content builder never scans.
let root: string;

const dirs = [
  "guide",
  "guide/advanced",
  "blog",
  ".config", // dotfile rule
  ".docs/components", // user theme layer
  "dist/assets",
  "node_modules/.pnpm/vite@8.2.1/node_modules/vite/dist/node",
  "guide/node_modules/nested",
];

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "undocs-watch-"));
  for (const d of dirs) mkdirSync(join(root, d), { recursive: true });
  writeFileSync(join(root, "guide/index.md"), "# hi\n");
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

const rel = (abs: string) => relative(root, abs).split(sep).join("/");

describe("collectWatchDirs", () => {
  it("watches the root and every content dir", () => {
    const found = collectWatchDirs(root).map(rel);
    expect(found.sort()).toEqual(["", "blog", "guide", "guide/advanced"]);
  });

  it("never descends into node_modules, dist, dotfiles or .docs", () => {
    const found = collectWatchDirs(root).map(rel);
    for (const skipped of found) {
      expect(skipped).not.toMatch(/(^|\/)(node_modules|dist|\.)/);
    }
    // The blow-up this guards: one inotify watch per dir, node_modules included.
    expect(found.length).toBeLessThan(dirs.length);
  });

  it("stops at the cap", () => {
    expect(collectWatchDirs(root, 2)).toHaveLength(2);
    expect(collectWatchDirs(root, 1)).toEqual([root]);
  });

  it("does not follow symlinked dirs", () => {
    const link = join(root, "guide/linked");
    symlinkSync(join(root, "blog"), link, "dir");
    try {
      expect(collectWatchDirs(root).map(rel)).not.toContain("guide/linked");
    } finally {
      rmSync(link, { force: true });
    }
  });

  it("survives an unreadable subtree", () => {
    expect(() => collectWatchDirs(join(root, "does-not-exist"))).not.toThrow();
  });
});
