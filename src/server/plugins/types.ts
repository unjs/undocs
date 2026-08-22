import type { NitroConfig } from "nitro/types";
import type { Plugin as VitePlugin } from "vite";
import type { UndocsAppConfig } from "../app-config.ts";
import type { BuildOptions } from "../content/builder.ts";
import type { PathClassification } from "../../shared/plugins/types.ts";

export interface UndocsPluginContext {
  docsDir: string;
  docs: Record<string, any>;
  options: Record<string, unknown>;
}

export interface UndocsServerPlugin {
  name: string;

  /** Transform build-time app config before `virtual:undocs/app-config` emit. */
  appConfig?(
    config: UndocsAppConfig,
    ctx: UndocsPluginContext,
  ): UndocsAppConfig | Promise<UndocsAppConfig>;

  /** Mutate Nitro options (runtimeConfig, prerender routes, …). */
  nitro?(nitro: NitroConfig, ctx: UndocsPluginContext): void | Promise<void>;

  /** Extra Vite plugins and/or directories that should reload app-config. */
  vite?(
    ctx: UndocsPluginContext,
  ):
    | { plugins?: VitePlugin[]; watchDirs?: string[] }
    | Promise<{ plugins?: VitePlugin[]; watchDirs?: string[] }>;

  content?: {
    buildOptions?(opts: BuildOptions, ctx: UndocsPluginContext): BuildOptions | void;
    /** Same-locale (or other) surround constraint. Default: accept all neighbors. */
    acceptSurroundNeighbor?(
      pagePath: string,
      neighborPath: string,
      ctx: UndocsPluginContext,
    ): boolean | void;
    /** Exclude from prev/next order. Return `true` to drop the path. */
    excludeFromOrder?(path: string, ctx: UndocsPluginContext): boolean | void;
    /** Include in `/api/docs/blog.json`. Return `true` when this path is a blog post. */
    isBlogPost?(path: string, ctx: UndocsPluginContext): boolean | void;
    /** Optional path classifier (blog, home, …). */
    classifyPath?(path: string, ctx: UndocsPluginContext): PathClassification | void;
  };
}

export interface UndocsPluginBundle {
  server?: UndocsServerPlugin;
  client?: unknown;
}
