/**
 * Single client-side plugin runner. Core calls this module only — never individual
 * plugins. A plugin package implements `UndocsClientPlugin` hooks; `PluginHost`
 * reduces them in registration order.
 */
import { clientPlugins } from "virtual:undocs/plugins-client";
import type { App, Component } from "vue";
import type { DocsConfig } from "../../../schema/config.d.ts";
import type { NavItem } from "@server/content/types.ts";
import type { AppRouter, RouteLocation, RouteRecord } from "@app/router.ts";
import type { UndocsClientPlugin, UndocsClientPluginContext } from "./types.ts";

export class PluginHost {
  readonly plugins: UndocsClientPlugin[];
  /** Last `install()` htmlLang from bootstrap (SSR + client). */
  htmlLang: string | undefined;

  constructor(plugins: UndocsClientPlugin[]) {
    this.plugins = plugins.filter(Boolean);
  }

  /** Build the reactive plugin context for the current route. */
  context(
    docs: Record<string, any>,
    router: AppRouter,
    routePath: string,
    route: RouteLocation,
  ): UndocsClientPluginContext {
    return { docs, router, routePath, route };
  }

  /** One call from `main.ts` / `entry-server.ts` — install + global component registration. */
  bootstrap(app: App, ctx: UndocsClientPluginContext): string | undefined {
    this.htmlLang = undefined;
    for (const plugin of this.plugins) {
      const result = plugin.install?.(app, ctx);
      if (result?.htmlLang) this.htmlLang = result.htmlLang;
      if (plugin.components) {
        for (const [name, component] of Object.entries(plugin.components)) {
          app.component(name, component);
        }
      }
    }
    return this.htmlLang;
  }

  /** Prepend plugin routes before the docs catch-all. */
  routes(base: RouteRecord[], docs: Record<string, any>): RouteRecord[] {
    let out = base;
    const stub = { docs, routePath: "/", router: null as any, route: null as any };
    for (const plugin of this.plugins) {
      if (!plugin.routes) continue;
      out = plugin.routes(out, stub);
    }
    return out;
  }

  /** Run the navigation hook pipeline. */
  navigation(
    nav: NavItem[] | null | undefined,
    ctx: UndocsClientPluginContext,
  ): NavItem[] | null | undefined {
    let out = nav;
    for (const plugin of this.plugins) {
      if (!plugin.navigation) continue;
      out = plugin.navigation(out, ctx);
    }
    return out;
  }

  /** Run the per-route docs-config hook pipeline. */
  docsConfig(docs: DocsConfig, ctx: UndocsClientPluginContext): DocsConfig {
    let out = docs;
    for (const plugin of this.plugins) {
      if (!plugin.docsConfig) continue;
      out = plugin.docsConfig(out, ctx);
    }
    return out;
  }

  /** Return false when any plugin rejects a path (search / WebMCP). */
  allowsPath(path: string, ctx: UndocsClientPluginContext): boolean {
    for (const plugin of this.plugins) {
      if (plugin.filterPath && plugin.filterPath(path, ctx) === false) return false;
    }
    return true;
  }

  /** Merge plugin MDC components after built-ins. */
  mergeMarkdownComponents(base: Record<string, Component>): Record<string, Component> {
    const out = { ...base };
    for (const plugin of this.plugins) {
      if (!plugin.components) continue;
      for (const [name, component] of Object.entries(plugin.components)) {
        if (!(name in out)) out[name] = component;
      }
    }
    return out;
  }

  /** Collect header action components from all plugins. */
  headerActions(): Component[] {
    const out: Component[] = [];
    for (const plugin of this.plugins) {
      if (!plugin.headerActions) continue;
      out.push(
        ...(Array.isArray(plugin.headerActions) ? plugin.headerActions : [plugin.headerActions]),
      );
    }
    return out;
  }

  /** Collect raw head entries from all plugins (merged in `mergePluginHead`). */
  head(ctx: UndocsClientPluginContext): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const plugin of this.plugins) {
      const entry = plugin.head?.(ctx);
      if (entry) out.push(entry);
    }
    return out;
  }
}

export const pluginHost = new PluginHost(clientPlugins as UndocsClientPlugin[]);
