import type { AppRouter } from "@app/router.ts";
import type { I18nRoutingStrategy } from "@i18n-micro/vue";
import { localizePath, type ResolvedI18nConfig } from "@app/utils/locale.ts";
import AppLink from "@app/components/app/AppLink.ts";

/**
 * Router adapter bridging undocs' from-scratch router to `@i18n-micro/vue`.
 * Uses `prefix_except_default` / `prefix` via {@link localizePath}.
 */
export function createUndocsRouterAdapter(
  router: AppRouter,
  i18n: ResolvedI18nConfig,
): I18nRoutingStrategy {
  const { localeCodes, defaultLocale, strategy } = i18n;

  const resolvePath = (to: string | { path?: string }, locale: string): string => {
    const path = typeof to === "string" ? to : to.path || "/";
    return localizePath(path, locale, defaultLocale, strategy, localeCodes);
  };

  return {
    linkComponent: AppLink,

    getCurrentPath: () => router.currentRoute.path,

    push: (target: { path: string }) => {
      void router.push(target.path);
    },

    replace: (target: { path: string }) => {
      void router.replace(target.path);
    },

    resolvePath: (to, locale) => resolvePath(to, locale),

    getRoute: () => {
      const route = router.currentRoute;
      const query: Record<string, string> = {};
      if (route.query) {
        const params = new URLSearchParams(route.query);
        for (const [k, v] of params) query[k] = v;
      }
      return { fullPath: route.fullPath, query };
    },
  };
}
