import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import {
  loadServerPlugins,
  moduleHasClientExport,
  pickClientPluginExport,
  resolveClientPluginImport,
} from "../../src/server/plugins/resolve.ts";

const echoDir = fileURLToPath(new URL("../fixtures/plugins/echo", import.meta.url));

describe("loadServerPlugins", () => {
  it("loads a local plugin entry by path", async () => {
    const docsDir = fileURLToPath(new URL("../fixtures", import.meta.url));
    const plugins = await loadServerPlugins(docsDir, {
      plugins: [echoDir],
    });
    expect(plugins).toHaveLength(1);
    expect(plugins[0]!.name).toBe("undocs-plugin-echo");
    expect(plugins[0]!.options).toEqual({});
  });

  it("preserves plugin options from config", async () => {
    const docsDir = fileURLToPath(new URL("../fixtures", import.meta.url));
    const plugins = await loadServerPlugins(docsDir, {
      plugins: [{ package: echoDir, options: { locale: "fr" } }],
    });
    expect(plugins[0]!.options).toEqual({ locale: "fr" });
  });
});

describe("moduleHasClientExport", () => {
  it("accepts bundle and client-only defaults", () => {
    expect(
      moduleHasClientExport({
        default: { server: { name: "s" }, client: { name: "c", install: () => {} } },
      }),
    ).toBe(true);
    expect(moduleHasClientExport({ default: { name: "c", install: () => {} } })).toBe(true);
    expect(moduleHasClientExport({ client: { name: "c" } })).toBe(true);
  });

  it("rejects server-only defaults", () => {
    expect(moduleHasClientExport({ default: { server: { name: "s" } } })).toBe(false);
    expect(
      moduleHasClientExport({
        default: { name: "s", appConfig: (c: unknown) => c },
      }),
    ).toBe(false);
  });
});

describe("resolveClientPluginImport", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("resolves echo fixture bundle entry", async () => {
    const docsDir = fileURLToPath(new URL("../fixtures", import.meta.url));
    const entry = await resolveClientPluginImport({ id: echoDir, options: {} }, docsDir);
    expect(entry).toBe(join(echoDir, "index.ts"));
  });

  it("prefers client.js over bundle root", async () => {
    tempDir = join(tmpdir(), `undocs-plugin-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, "client.js"), "export default { name: 'c', install() {} };\n");
    writeFileSync(
      join(tempDir, "index.js"),
      "export default { name: 's', appConfig(c){return c} };\n",
    );
    const entry = await resolveClientPluginImport({ id: tempDir, options: {} }, tempDir);
    expect(entry).toBe(join(tempDir, "client.js"));
  });

  it("resolves extensionless client directory", async () => {
    tempDir = join(tmpdir(), `undocs-plugin-${Date.now()}`);
    const clientDir = join(tempDir, "client");
    mkdirSync(clientDir, { recursive: true });
    writeFileSync(join(clientDir, "index.js"), "export default { name: 'c', install() {} };\n");
    const entry = await resolveClientPluginImport({ id: tempDir, options: {} }, tempDir);
    expect(entry).toBe(join(clientDir, "index.js"));
  });

  it("returns null when root exports only a server plugin", async () => {
    tempDir = join(tmpdir(), `undocs-plugin-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(
      join(tempDir, "index.js"),
      "export default { name: 'srv-only', appConfig(c){return c} };\n",
    );
    const entry = await resolveClientPluginImport({ id: tempDir, options: {} }, tempDir);
    expect(entry).toBeNull();
  });

  it("returns null when no client entry exists", async () => {
    tempDir = join(tmpdir(), `undocs-plugin-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, "server.js"), "export default {};\n");
    const entry = await resolveClientPluginImport({ id: tempDir, options: {} }, tempDir);
    expect(entry).toBeNull();
  });
});

describe("pickClientPluginExport", () => {
  it("picks client from a default bundle export", () => {
    const client = { name: "client-plugin" };
    const picked = pickClientPluginExport({ default: { client, server: {} } });
    expect(picked).toBe(client);
  });

  it("falls back to namespace export", () => {
    const client = { name: "direct-client" };
    expect(pickClientPluginExport({ client })).toBe(client);
  });
});
