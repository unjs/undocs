import { describe, it, expect } from "vitest";
import { normalizePluginSpecs } from "../../src/shared/plugins/types.ts";
import {
  applyAppConfigPlugins,
  applyBuildOptionsPlugins,
  acceptSurroundNeighbor,
  defaultExcludeFromOrder,
  excludeFromOrder,
  isBlogPostPath,
  pluginContext,
} from "../../src/server/plugins/apply.ts";
import type { UndocsServerPlugin } from "../../src/server/plugins/types.ts";
import { PluginHost } from "../../src/app/plugins/host.ts";
import type { UndocsClientPlugin } from "../../src/app/plugins/types.ts";
import echoPlugin from "../fixtures/plugins/echo/index.ts";

describe("plugin spec normalization", () => {
  it("normalizes string and object entries", () => {
    expect(
      normalizePluginSpecs(["@undocs/i18n", { package: "./local", options: { x: 1 } }]),
    ).toEqual([
      { id: "@undocs/i18n", options: {} },
      { id: "./local", options: { x: 1 } },
    ]);
  });
});

describe("server plugin apply", () => {
  const ctx = pluginContext("/tmp/docs", { plugins: ["echo"] });

  it("runs appConfig hooks in order", async () => {
    const plugin: UndocsServerPlugin = {
      name: "a",
      appConfig(config) {
        config.docs.flag = "a";
        return config;
      },
    };
    const out = await applyAppConfigPlugins(
      {
        docs: {},
        site: { name: "", description: "", url: undefined },
        ui: { colors: { primary: "mono" } },
      },
      [plugin],
      ctx,
    );
    expect(out.docs.flag).toBe("a");
  });

  it("excludes default blog paths from order", () => {
    expect(defaultExcludeFromOrder("/blog")).toBe(true);
    expect(defaultExcludeFromOrder("/blog/post")).toBe(true);
    expect(defaultExcludeFromOrder("/guide")).toBe(false);
  });

  it("echo fixture excludes /echo-hidden and accepts locale surround rules", () => {
    const server = echoPlugin.server!;
    const plugins = [server];
    expect(excludeFromOrder("/echo-hidden", plugins, ctx)).toBe(true);
    expect(excludeFromOrder("/guide", plugins, ctx)).toBe(false);
    expect(isBlogPostPath("/echo-blog/post", plugins, ctx)).toBe(true);
    expect(acceptSurroundNeighbor("/echo/page", "/guide/other", plugins, ctx)).toBe(false);
    expect(acceptSurroundNeighbor("/echo/page", "/echo/next", plugins, ctx)).toBe(true);
  });

  it("merges buildOptions from plugins", () => {
    const server = echoPlugin.server!;
    const out = applyBuildOptionsPlugins({ dir: "/tmp" }, [server], ctx);
    expect(out.automd).toBe("echo-marker");
  });
});

describe("PluginHost", () => {
  const baseCtx = {
    docs: { name: "Docs" },
    routePath: "/guide",
    router: {} as any,
    route: { path: "/guide", hash: "", query: "", fullPath: "/guide", meta: {} },
  };

  it("reduces client hooks from echo fixture", () => {
    const host = new PluginHost([echoPlugin.client as UndocsClientPlugin]);
    const nav = [{ title: "Guide", path: "/guide", page: true }];
    expect(host.navigation(nav, baseCtx)?.[0]?.title).toBe("Guide [echo]");
    expect(host.docsConfig({ name: "Docs" } as any, baseCtx).name).toBe("Docs [echo]");
    expect(host.allowsPath("/echo-hidden", baseCtx)).toBe(false);
    expect(host.allowsPath("/guide", baseCtx)).toBe(true);
    expect(host.routes([], baseCtx.docs)).toHaveLength(1);
    expect(host.headerActions()).toHaveLength(1);
    expect(host.head(baseCtx)).toHaveLength(1);
    expect(host.mergeMarkdownComponents({ alert: {} as any })["echo-badge"]).toBeTruthy();
  });
});
