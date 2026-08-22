import type { NitroConfig } from "nitro/types";
import type { UndocsAppConfig } from "../app-config.ts";
import type { BuildOptions } from "../content/builder.ts";
import type { UndocsPluginContext, UndocsServerPlugin } from "./types.ts";
import { isWithin } from "../../app/utils/nav.ts";

export function pluginContext(
  docsDir: string,
  docs: Record<string, any>,
  options: Record<string, unknown> = {},
): UndocsPluginContext {
  return { docsDir, docs, options };
}

export async function applyAppConfigPlugins(
  config: UndocsAppConfig,
  plugins: UndocsServerPlugin[],
  ctx: UndocsPluginContext,
): Promise<UndocsAppConfig> {
  let out = config;
  for (const plugin of plugins) {
    if (!plugin.appConfig) continue;
    out = await plugin.appConfig(out, { ...ctx, options: ctx.options });
  }
  return out;
}

export async function applyNitroPlugins(
  nitro: NitroConfig,
  plugins: UndocsServerPlugin[],
  ctx: UndocsPluginContext,
): Promise<void> {
  for (const plugin of plugins) {
    if (!plugin.nitro) continue;
    await plugin.nitro(nitro, ctx);
  }
}

export function applyBuildOptionsPlugins(
  opts: BuildOptions,
  plugins: UndocsServerPlugin[],
  ctx: UndocsPluginContext,
): BuildOptions {
  let out = opts;
  for (const plugin of plugins) {
    if (!plugin.content?.buildOptions) continue;
    const next = plugin.content.buildOptions(out, ctx);
    if (next) out = next;
  }
  return out;
}

/** Default monolingual blog paths excluded from surround order. */
export function defaultExcludeFromOrder(path: string): boolean {
  return path === "/blog" || path.startsWith("/blog/") || isWithin(path, "/blog");
}

export function excludeFromOrder(
  path: string,
  plugins: UndocsServerPlugin[],
  ctx: UndocsPluginContext,
): boolean {
  for (const plugin of plugins) {
    const verdict = plugin.content?.excludeFromOrder?.(path, ctx);
    if (verdict === true) return true;
    if (verdict === false) return false;
  }
  return defaultExcludeFromOrder(path);
}

export function acceptSurroundNeighbor(
  pagePath: string,
  neighborPath: string,
  plugins: UndocsServerPlugin[],
  ctx: UndocsPluginContext,
): boolean {
  for (const plugin of plugins) {
    const verdict = plugin.content?.acceptSurroundNeighbor?.(pagePath, neighborPath, ctx);
    if (verdict === false) return false;
  }
  return true;
}

export function isBlogPostPath(
  path: string,
  plugins: UndocsServerPlugin[],
  ctx: UndocsPluginContext,
): boolean {
  if (path.startsWith("/blog/")) return true;
  for (const plugin of plugins) {
    const verdict = plugin.content?.isBlogPost?.(path, ctx);
    if (verdict === true) return true;
    if (verdict === false) return false;
  }
  return false;
}
