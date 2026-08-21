/**
 * Per-locale docs chrome config with `defu` fallback onto the root `docs` config
 * (VitePress-style `locales.*.themeConfig` merge).
 */
import { computed, type ComputedRef } from "vue";
import { defu } from "defu";
import { useRoute } from "@app/router.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { getLocaleFromPath, resolveI18nConfig, type I18nLocaleConfig } from "@app/utils/locale.ts";
import type { DocsConfig } from "../../../schema/config.d.ts";
import type { NavItem } from "@server/content/types.ts";

export type LocaleChromeOverrides = Pick<
  DocsConfig,
  "name" | "shortDescription" | "description" | "landing" | "banner" | "versions"
> & {
  /** Optional nav patch: path → title/hide overrides, or a full replacement tree. */
  navigation?: NavItem[] | Record<string, { title?: string; hide?: boolean }>;
};

export type LocaleDocsConfig = DocsConfig & {
  /** Active locale code (or default when i18n is off). */
  _locale: string;
};

function localeOverrides(entry: I18nLocaleConfig | undefined): LocaleChromeOverrides {
  if (!entry) return {};
  const { landing, banner, versions, name, shortDescription, description, navigation } =
    entry as I18nLocaleConfig & LocaleChromeOverrides;
  return {
    ...(landing !== undefined ? { landing } : {}),
    ...(banner !== undefined ? { banner } : {}),
    ...(versions !== undefined ? { versions } : {}),
    ...(name !== undefined ? { name } : {}),
    ...(shortDescription !== undefined ? { shortDescription } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(navigation !== undefined ? { navigation } : {}),
  };
}

/** Apply `{ "/guide": { title } }` patches onto a content-driven nav tree. */
export function applyNavPatch(
  nav: NavItem[] | null | undefined,
  patch: Record<string, { title?: string; hide?: boolean }> | undefined,
): NavItem[] {
  if (!nav?.length) return nav ?? [];
  if (!patch || Object.keys(patch).length === 0) return nav;

  const walk = (items: NavItem[]): NavItem[] =>
    items
      .map((item) => {
        const key = item.path;
        const p = key ? patch[key] : undefined;
        if (p?.hide) return null;
        const children = item.children ? walk(item.children) : undefined;
        return {
          ...item,
          ...(p?.title !== undefined ? { title: p.title } : {}),
          ...(children ? { children } : {}),
        } as NavItem;
      })
      .filter(Boolean) as NavItem[];

  return walk(nav);
}

export function useLocaleDocsConfig(): ComputedRef<LocaleDocsConfig> {
  const appConfig = useAppConfig();
  const route = useRoute();
  const i18nConfig = resolveI18nConfig(appConfig.docs as { lang?: string; i18n?: any });

  return computed(() => {
    const root = appConfig.docs as DocsConfig;
    if (!i18nConfig.enabled) {
      return { ...root, _locale: i18nConfig.defaultLocale };
    }
    const code = getLocaleFromPath(
      route.path,
      i18nConfig.localeCodes,
      i18nConfig.defaultLocale,
      i18nConfig.strategy,
    );
    const entry = i18nConfig.locales.find((l) => l.code === code);
    const merged = defu(localeOverrides(entry), root) as DocsConfig;
    return { ...merged, _locale: code };
  });
}
