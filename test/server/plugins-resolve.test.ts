import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { loadServerPlugins } from "../../src/server/plugins/resolve.ts";

const echoDir = fileURLToPath(new URL("../fixtures/plugins/echo", import.meta.url));

describe("loadServerPlugins", () => {
  it("loads a local plugin entry by path", async () => {
    const docsDir = fileURLToPath(new URL("../fixtures", import.meta.url));
    const plugins = await loadServerPlugins(docsDir, {
      plugins: [echoDir],
    });
    expect(plugins).toHaveLength(1);
    expect(plugins[0]!.name).toBe("undocs-plugin-echo");
  });
});
