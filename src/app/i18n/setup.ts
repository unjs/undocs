import { createI18n, type I18nPlugin, type Locale, type Translations } from "@i18n-micro/vue";
import type { AppRouter } from "@app/router.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { getLocaleFromPath, resolveI18nConfig } from "@app/utils/locale.ts";
import { createUndocsRouterAdapter } from "@app/i18n/router-adapter.ts";
import { uiMessages } from "@shared/i18n-messages.ts";

function mergeTranslations(
  base: Record<string, unknown>,
  extra: Record<string, unknown> | undefined,
): Translations {
  if (!extra) return { ...base } as Translations;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      out[key] &&
      typeof out[key] === "object" &&
      !Array.isArray(out[key])
    ) {
      out[key] = mergeTranslations(
        out[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      out[key] = value;
    }
  }
  return out as Translations;
}

/**
 * Build the `@i18n-micro/vue` plugin for undocs (client + SSR).
 * Locale is taken from `initialPath` when provided (SSR request URL / client pathname).
 */
export function createUndocsI18n(router: AppRouter, initialPath?: string): I18nPlugin {
  const docs = useAppConfig().docs as {
    lang?: string;
    i18n?: any;
    _i18nMessages?: Record<string, Record<string, unknown>>;
    _i18nRouteMessages?: Record<string, Record<string, Record<string, unknown>>>;
  };
  const i18nConfig = resolveI18nConfig({ lang: docs?.lang, i18n: docs?.i18n });
  const pathOnly = (initialPath ?? router.currentRoute.path).split("?")[0]!.split("#")[0]!;
  const locale = getLocaleFromPath(
    pathOnly,
    i18nConfig.localeCodes,
    i18nConfig.defaultLocale,
    i18nConfig.strategy,
  );

  const userMessages = docs._i18nMessages || {};
  const routeMessages = docs._i18nRouteMessages || {};
  const messages: Record<string, Translations> = {};

  for (const code of i18nConfig.localeCodes) {
    const shipped = (uiMessages[code] ?? uiMessages.en ?? {}) as Record<string, unknown>;
    const userRoot = { ...userMessages[code] };
    // Legacy sentinel — drop if an old build still nested routes here.
    delete (userRoot as { __routes__?: unknown }).__routes__;
    messages[code] = mergeTranslations(shipped, userRoot);
  }

  // Union of page route names across locales → register for EVERY locale with
  // merge(root, pageDict||{}), so setRoute(derived) always keeps chrome keys.
  const routeNames = new Set<string>();
  for (const byRoute of Object.values(routeMessages)) {
    for (const name of Object.keys(byRoute)) routeNames.add(name);
  }

  const routingStrategy = createUndocsRouterAdapter(router, i18nConfig);
  const locales: Locale[] = i18nConfig.locales.map((l) => ({
    code: l.code,
    iso: l.iso,
    displayName: l.displayName,
  }));

  const plugin = createI18n({
    locale,
    fallbackLocale: i18nConfig.defaultLocale,
    locales,
    defaultLocale: i18nConfig.defaultLocale,
    messages,
    routingStrategy,
  });

  for (const routeName of routeNames) {
    for (const code of i18nConfig.localeCodes) {
      const root = messages[code] || {};
      const pageDict = routeMessages[code]?.[routeName];
      plugin.global.addRouteTranslations(code, routeName, mergeTranslations(root, pageDict));
    }
  }

  return plugin;
}
