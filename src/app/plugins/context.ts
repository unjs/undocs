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

const MERGE_ARRAY_HEAD_KEYS = new Set(["meta", "link", "script", "style"]);

/** Merge multiple plugin head entries (meta/link/script arrays concatenate). */
export function mergeHeadEntries(entries: Record<string, unknown>[]): Record<string, unknown> {
  if (!entries.length) return {};
  const out: Record<string, unknown> = {};
  for (const entry of entries) {
    for (const [key, value] of Object.entries(entry)) {
      if (MERGE_ARRAY_HEAD_KEYS.has(key) && Array.isArray(value)) {
        const prev = out[key];
        out[key] = [...(Array.isArray(prev) ? prev : []), ...value];
      } else {
        out[key] = value;
      }
    }
  }
  return out;
}

/** Merge plugin head entries for unhead. */
export function mergePluginHead(ctx: UndocsClientPluginContext): Record<string, unknown> {
  return mergeHeadEntries(pluginHost.head(ctx));
}
