import type { App, Component } from "vue";
import type { DocsConfig } from "../../../schema/config.d.ts";
import type { NavItem } from "@server/content/types.ts";
import type { AppRouter, RouteLocation, RouteRecord } from "@app/router.ts";
import type { UndocsServerPlugin } from "../../server/plugins/types.ts";

export interface UndocsClientPluginContext {
  docs: Record<string, any>;
  routePath: string;
  router: AppRouter;
  route: RouteLocation;
}

export interface UndocsClientPlugin {
  name: string;

  /** Called from `main.ts` and `entry-server.ts` (must match for hydration). */
  install?(app: App, ctx: UndocsClientPluginContext): void | { htmlLang?: string };

  /** Extend the built-in route table (prepended before catch-all matching). */
  routes?(routes: RouteRecord[], ctx: Pick<UndocsClientPluginContext, "docs">): RouteRecord[];

  /** Transform navigation tree after locale/content filtering. */
  navigation?(
    nav: NavItem[] | null | undefined,
    ctx: UndocsClientPluginContext,
  ): NavItem[] | null | undefined;

  /** Per-route docs chrome config (landing, banner, …). */
  docsConfig?(docs: DocsConfig, ctx: UndocsClientPluginContext): DocsConfig;

  /** Search palette + WebMCP: return `false` to drop a result path. */
  filterPath?(path: string, ctx: UndocsClientPluginContext): boolean;

  /** Extra `<head>` entries (hreflang, og:locale, …). */
  head?(ctx: UndocsClientPluginContext): Record<string, unknown> | void;

  /** MDC + global components merged after built-ins. */
  components?: Record<string, Component>;

  /** Rendered in the desktop header action cluster (`AppHeaderActions`). */
  headerActions?: Component | Component[];
}

/** Identity helper for a single server or client plugin export. */
export function defineUndocsPlugin<T extends UndocsClientPlugin | UndocsServerPlugin>(
  plugin: T,
): T {
  return plugin;
}

/** Identity helper for a `{ server, client }` plugin package export. */
export function defineUndocsPluginBundle(bundle: {
  server?: UndocsServerPlugin;
  client?: UndocsClientPlugin;
}) {
  return bundle;
}
