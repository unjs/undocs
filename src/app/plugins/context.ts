import { computed, type ComputedRef } from "vue";
import { useRoute, useRouter } from "@app/router.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { pluginHost } from "@app/plugins/host.ts";
import type { UndocsClientPluginContext } from "@app/plugins/types.ts";
import type { NavItem } from "@server/content/types.ts";
import type { DocsConfig } from "../../../schema/config.d.ts";

/** Reactive plugin context for the current route (client + SSR). */
export function usePluginContext(): ComputedRef<UndocsClientPluginContext> {
  const route = useRoute();
  const router = useRouter();
  const appConfig = useAppConfig();
  return computed(() => pluginHost.context(appConfig.docs, router, route.fullPath, route));
}

/** Run the navigation plugin pipeline on a content tree. */
export function applyPluginNavigationTree(
  nav: NavItem[] | null | undefined,
  ctx: UndocsClientPluginContext,
): NavItem[] | null | undefined {
  return pluginHost.navigation(nav, ctx) ?? nav;
}

/** Run the docs-config plugin pipeline. */
export function applyPluginDocsConfig(
  docs: DocsConfig,
  ctx: UndocsClientPluginContext,
): DocsConfig {
  return pluginHost.docsConfig(docs, ctx);
}

/** Merge plugin head entries for unhead. */
export function mergePluginHead(ctx: UndocsClientPluginContext): Record<string, unknown> {
  const entries = pluginHost.head(ctx);
  if (!entries.length) return {};
  return Object.assign({}, ...entries);
}
