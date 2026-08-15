import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { MockInstance } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIndex } from "../../src/server/content/builder.ts";

// automd runs node-side generators against the repo it documents, so a real one
// is not what this is about: the module is stubbed and only the builder's
// handling of its RESULT is exercised. Every failure automd can report leaves
// the page building from its untransformed source — which looks exactly like a
// page nobody updated — so what is pinned here is that each one says so, and
// names the file it happened in.
const automd = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  transform: vi.fn(),
}));
vi.mock("automd", () => automd);

const SOURCE = "# Badged\n\n<!-- automd:badges -->\n\nplaceholder\n\n<!-- /automd -->\n\nBody.\n";

let dir: string;
let warn: MockInstance<typeof console.warn>;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "undocs-automd-"));
  await writeFile(join(dir, "badged.md"), SOURCE);
  automd.loadConfig.mockReset().mockResolvedValue({});
  automd.transform.mockReset();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  warn.mockRestore();
  if (dir) await rm(dir, { recursive: true, force: true });
});

const warnings = () => warn.mock.calls.map((c) => String(c[0]));

describe("automd diagnostics", () => {
  it("applies the transform and stays quiet when it succeeds", async () => {
    automd.transform.mockResolvedValue({
      hasChanged: true,
      hasIssues: false,
      contents: "# Badged\n\ngenerated badge row\n\nBody.\n",
      updates: [],
      time: 0,
    });

    const index = await buildIndex({ dir, automd: {} });

    expect(automd.transform).toHaveBeenCalledTimes(1);
    expect(index.byPath.get("/badged")?.automd).toBe(true);
    expect(JSON.stringify(index.byPath.get("/badged")?.body)).toContain("generated badge row");
    expect(warnings()).toEqual([]);
  });

  it("reports the generators' issues, with the file path", async () => {
    automd.transform.mockResolvedValue({
      hasChanged: true,
      hasIssues: true,
      contents: "# Badged\n\n<!-- ⚠️  (badges) no package.json -->\n\nBody.\n",
      updates: [
        {
          block: { generator: "badges" },
          result: { contents: "", issues: ["no package.json found", ""] },
        },
        { block: { generator: "pm-install" }, result: { contents: "", issues: undefined } },
      ],
      time: 0,
    });

    const index = await buildIndex({ dir, automd: {} });

    const warned = warnings().find((w) => w.includes("automd issues"));
    expect(warned).toBeDefined();
    expect(warned).toContain('[undocs] automd issues in "badged.md"');
    expect(warned).toContain("badges: no package.json found");
    // Empty issue strings and issue-free blocks add no lines.
    expect(warned).not.toContain("pm-install");
    expect(warned!.split("\n")).toHaveLength(2);

    // The source is kept, so automd's own ⚠️ marker never reaches the page.
    const body = JSON.stringify(index.byPath.get("/badged")?.body);
    expect(body).toContain("placeholder");
    expect(body).not.toContain("⚠️");
  });

  it("reports a transform that throws, with the file path", async () => {
    automd.transform.mockRejectedValue(new Error("generator exploded"));

    const index = await buildIndex({ dir, automd: {} });

    const warned = warnings().find((w) => w.includes("automd failed"));
    expect(warned).toBeDefined();
    expect(warned).toContain('[undocs] automd failed for "badged.md"');
    expect(warned).toContain("generator exploded");

    // Recoverable: the page still builds, from its own source.
    expect(JSON.stringify(index.byPath.get("/badged")?.body)).toContain("placeholder");
  });

  it("reports automd itself failing to load", async () => {
    automd.loadConfig.mockRejectedValue(new Error("bad automd config"));

    const index = await buildIndex({ dir, automd: {} });

    const warned = warnings().find((w) => w.includes("could not be loaded"));
    expect(warned).toBeDefined();
    expect(warned).toContain("bad automd config");
    expect(automd.transform).not.toHaveBeenCalled();
    expect(index.byPath.get("/badged")?.automd).toBe(false);
  });

  it("does not touch automd when the docs config does not ask for it", async () => {
    await buildIndex({ dir });

    expect(automd.loadConfig).not.toHaveBeenCalled();
    expect(automd.transform).not.toHaveBeenCalled();
    expect(warnings()).toEqual([]);
  });
});
