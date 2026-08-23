import type { NitroConfig } from "nitro/types";
import type { UndocsAppConfig } from "../app-config.ts";
import type { BuildOptions } from "../content/builder.ts";
import type { UndocsPluginContext, UndocsServerPlugin } from "./types.ts";
import { isWithin } from "../../app/utils/nav.ts";

/** Shared hook context for a docs directory (per-plugin `options` override per call). */
export function pluginContext(
  docsDir: string,
  docs: Record<string, any>,
  options: Record<string, unknown> = {},
): UndocsPluginContext {
  return { docsDir, docs, options };
}

/** Overlay a plugin's own `options` onto the shared docs context. */
function pluginCtx(base: UndocsPluginContext, plugin: UndocsServerPlugin): UndocsPluginContext {
  return { ...base, options: plugin.options ?? {} };
}

/** Run `appConfig` hooks in registration order. */
export async function applyAppConfigPlugins(
  config: UndocsAppConfig,
  plugins: UndocsServerPlugin[],
  ctx: UndocsPluginContext,
): Promise<UndocsAppConfig> {
  let out = config;
  for (const plugin of plugins) {
    if (!plugin.appConfig) continue;
    out = await plugin.appConfig(out, pluginCtx(ctx, plugin));
  }
  return out;
}

/** Run `nitro` hooks in registration order. */
export async function applyNitroPlugins(
  nitro: NitroConfig,
  plugins: UndocsServerPlugin[],
  ctx: UndocsPluginContext,
): Promise<void> {
  for (const plugin of plugins) {
    if (!plugin.nitro) continue;
    await plugin.nitro(nitro, pluginCtx(ctx, plugin));
  }
}

/** Run `content.buildOptions` hooks before `buildIndex`. */
export function applyBuildOptionsPlugins(
  opts: BuildOptions,
  plugins: UndocsServerPlugin[],
  ctx: UndocsPluginContext,
): BuildOptions {
  let out = opts;
  for (const plugin of plugins) {
    if (!plugin.content?.buildOptions) continue;
    const next = plugin.content.buildOptions(out, pluginCtx(ctx, plugin));
    if (next) out = next;
  }
  return out;
}

/** Default monolingual blog paths excluded from surround order. */
export function defaultExcludeFromOrder(path: string): boolean {
  return path === "/blog" || path.startsWith("/blog/") || isWithin(path, "/blog");
}

/** Whether `path` is excluded from prev/next order (plugin hooks, then default blog rule). */
export function excludeFromOrder(
  path: string,
  plugins: UndocsServerPlugin[],
  ctx: UndocsPluginContext,
): boolean {
  for (const plugin of plugins) {
    const verdict = plugin.content?.excludeFromOrder?.(path, pluginCtx(ctx, plugin));
    if (verdict === true) return true;
    if (verdict === false) return false;
  }
  return defaultExcludeFromOrder(path);
}

/** Whether `neighborPath` is an acceptable prev/next neighbor for `pagePath`. */
export function acceptSurroundNeighbor(
  pagePath: string,
  neighborPath: string,
  plugins: UndocsServerPlugin[],
  ctx: UndocsPluginContext,
): boolean {
  for (const plugin of plugins) {
    const verdict = plugin.content?.acceptSurroundNeighbor?.(
      pagePath,
      neighborPath,
      pluginCtx(ctx, plugin),
    );
    if (verdict === false) return false;
  }
  return true;
}

/** Whether `path` counts as a blog post for `/api/docs/blog.json`. */
export function isBlogPostPath(
  path: string,
  plugins: UndocsServerPlugin[],
  ctx: UndocsPluginContext,
): boolean {
  if (path.startsWith("/blog/")) return true;
  for (const plugin of plugins) {
    const verdict = plugin.content?.isBlogPost?.(path, pluginCtx(ctx, plugin));
    if (verdict === true) return true;
    if (verdict === false) return false;
  }
  return false;
}
