/**
 * Locale path helpers for multilingual docs (issue unjs/undocs#219).
 *
 * Content convention (`prefix_except_default`):
 *   - default locale pages live at the docs root → `/guide`
 *   - other locales live under `docs/<code>/…` → `/ru/guide`
 */
import type { NavItem } from "@server/content/types.ts";

export interface I18nLocaleConfig {
  code: string;
  iso?: string;
  displayName?: string;
  name?: string;
  shortDescription?: string;
  description?: string;
  landing?: unknown;
  banner?: unknown;
  versions?: unknown;
  navigation?: unknown;
}

export interface I18nDocsConfig {
  locales?: Array<string | I18nLocaleConfig>;
  defaultLocale?: string;
  /** URL strategy. Only `prefix_except_default` is fully wired for content folders. */
  strategy?: "prefix" | "prefix_except_default";
  translationDir?: string;
}

export interface ResolvedI18nConfig {
  locales: I18nLocaleConfig[];
  localeCodes: string[];
  defaultLocale: string;
  strategy: "prefix" | "prefix_except_default";
  /**
   * True only when `docs.i18n` is explicitly set (opt-in).
   * Without the block the site stays monolingual like pre-i18n undocs.
   */
  enabled: boolean;
}

function normalizeLocale(entry: string | I18nLocaleConfig): I18nLocaleConfig {
  if (typeof entry === "string") return { code: entry, displayName: entry };
  return entry;
}

/**
 * Resolve i18n settings from docs config.
 * Opt-in: `docs.i18n` must be present. Without it → single locale from `docs.lang`.
 */
export function resolveI18nConfig(
  docs: {
    lang?: string;
    i18n?: I18nDocsConfig;
  } = {},
): ResolvedI18nConfig {
  const fallback = docs.lang || "en";
  const raw = docs.i18n?.locales?.map(normalizeLocale) ?? [];
  const locales = raw.length > 0 ? raw : [{ code: fallback, iso: fallback, displayName: fallback }];
  const localeCodes = locales.map((l) => l.code);
  const defaultLocale =
    docs.i18n?.defaultLocale && localeCodes.includes(docs.i18n.defaultLocale)
      ? docs.i18n.defaultLocale
      : localeCodes.includes(fallback)
        ? fallback
        : localeCodes[0]!;
  const strategy = docs.i18n?.strategy ?? "prefix_except_default";
  return {
    locales,
    localeCodes,
    defaultLocale,
    strategy,
    // Explicit `docs.i18n.locales` (≥1) opts in. Empty/missing block → monolingual.
    enabled: Boolean(docs.i18n?.locales?.length),
  };
}

/** First path segment if it is a configured locale code. */
export function localeSegment(path: string, localeCodes: string[]): string | undefined {
  const seg = path.replace(/^\//, "").split("/")[0];
  return seg && localeCodes.includes(seg) ? seg : undefined;
}

/**
 * Locale implied by a URL path.
 * `prefix_except_default`: unprefixed paths → defaultLocale.
 * `prefix`: missing/unknown prefix → defaultLocale.
 */
export function getLocaleFromPath(
  path: string,
  localeCodes: string[],
  defaultLocale: string,
  strategy: ResolvedI18nConfig["strategy"] = "prefix_except_default",
): string {
  const seg = localeSegment(path, localeCodes);
  if (seg) return seg;
  if (strategy === "prefix" && path !== "/") {
    // Unprefixed path under `prefix` strategy — treat as default.
    return defaultLocale;
  }
  return defaultLocale;
}

/** Strip a leading locale segment (`/ru/guide` → `/guide`). */
export function stripLocalePrefix(path: string, localeCodes: string[]): string {
  const seg = localeSegment(path, localeCodes);
  if (!seg) return path === "" ? "/" : path;
  const rest = path.slice(seg.length + 1) || "/";
  return rest.startsWith("/") ? rest : `/${rest}`;
}

/**
 * Localize an internal path for `locale` under the active strategy.
 * Input may already be prefixed; the prefix is normalized first.
 */
export function localizePath(
  path: string,
  locale: string,
  defaultLocale: string,
  strategy: ResolvedI18nConfig["strategy"],
  localeCodes: string[],
): string {
  const clean = stripLocalePrefix(path || "/", localeCodes);
  if (strategy === "prefix_except_default" && locale === defaultLocale) {
    return clean;
  }
  if (clean === "/") return `/${locale}`;
  return `/${locale}${clean}`;
}

/**
 * Filter the content nav tree to the active locale.
 * Non-default locales live under a top-level `/{code}` folder in the builder tree.
 */
export function filterNavByLocale(
  navigation: NavItem[] | null | undefined,
  locale: string,
  defaultLocale: string,
  localeCodes: string[],
): NavItem[] {
  const tree = navigation ?? [];
  const nonDefault = new Set(localeCodes.filter((c) => c !== defaultLocale));

  if (locale === defaultLocale) {
    return tree.filter((item) => {
      const seg = item.path === "/" ? "" : item.path.replace(/^\//, "").split("/")[0]!;
      return !nonDefault.has(seg);
    });
  }

  const localeRoot = tree.find((item) => {
    const seg = item.path.replace(/^\//, "").split("/")[0];
    return seg === locale;
  });
  if (!localeRoot) return [];

  const children = localeRoot.children ?? [];
  if (localeRoot.page) {
    const own = children.filter((c) => c.path !== localeRoot.path);
    return [
      {
        title: localeRoot.title,
        path: localeRoot.path,
        icon: localeRoot.icon,
        page: true,
        root: true,
        description: localeRoot.description,
      },
      ...own,
    ];
  }
  return children;
}

/** Home path for a locale (`/` or `/ru`). */
export function localeHomePath(
  locale: string,
  defaultLocale: string,
  strategy: ResolvedI18nConfig["strategy"],
): string {
  if (strategy === "prefix_except_default" && locale === defaultLocale) return "/";
  return `/${locale}`;
}

function pathInNavTree(tree: NavItem[], path: string): boolean {
  for (const item of tree) {
    if (item.path === path) return true;
    if (item.children?.length && pathInNavTree(item.children, path)) return true;
  }
  return false;
}

/**
 * Path for a locale alternate of `path`: same page if it exists in that locale's
 * nav tree, otherwise the locale home (mirrors LocaleSwitcher).
 */
export function localeAlternatePath(
  path: string,
  targetLocale: string,
  rawNavigation: NavItem[] | null | undefined,
  i18n: Pick<ResolvedI18nConfig, "defaultLocale" | "strategy" | "localeCodes">,
): string {
  const home = localeHomePath(targetLocale, i18n.defaultLocale, i18n.strategy);
  const localized = localizePath(
    path,
    targetLocale,
    i18n.defaultLocale,
    i18n.strategy,
    i18n.localeCodes,
  );
  if (localized === home) return home;
  const localeNav = filterNavByLocale(
    rawNavigation,
    targetLocale,
    i18n.defaultLocale,
    i18n.localeCodes,
  );
  return pathInNavTree(localeNav, localized) ? localized : home;
}

/**
 * VitePress-style route name for i18n page dicts.
 * `/` → `index`, `/guide/i18n` → `guide-i18n`, `/ru/guide` → `guide`.
 */
export function routeNameFromPath(path: string, localeCodes: string[]): string {
  const clean = stripLocalePrefix(path || "/", localeCodes);
  const segments = clean.split("/").filter(Boolean);
  if (segments.length === 0) return "index";
  return segments.join("-").replace(/\.html$/, "");
}

/**
 * Whether `setRoute` should use a page dict for this locale.
 * With union×locales registration every locale gets every route name — still
 * prefer the per-locale map when present so asymmetric configs stay correct.
 */
export function pageRouteForLocale(
  derived: string,
  locale: string,
  pageRoutes: Record<string, string[]> | string[] | undefined,
): string {
  if (!pageRoutes) return "index";
  if (Array.isArray(pageRoutes)) {
    return pageRoutes.includes(derived) ? derived : "index";
  }
  const forLocale = pageRoutes[locale];
  if (forLocale?.includes(derived)) return derived;
  // Union registration: any locale listing the route means every locale has a
  // merged bucket — still OK to setRoute(derived).
  for (const names of Object.values(pageRoutes)) {
    if (names.includes(derived)) return derived;
  }
  return "index";
}

/** True when `path` belongs to the same locale as `currentLocale`. */
export function isSameLocalePath(
  path: string,
  currentLocale: string,
  localeCodes: string[],
  defaultLocale: string,
  strategy: ResolvedI18nConfig["strategy"] = "prefix_except_default",
  enabled = true,
): boolean {
  if (!enabled) return true;
  const hitLocale = getLocaleFromPath(
    (path.split("#")[0] || "/").split("?")[0] || "/",
    localeCodes,
    defaultLocale,
    strategy,
  );
  return hitLocale === currentLocale;
}

/** Whether locale SEO alternates (hreflang / og:locale) should be emitted. */
export function shouldEmitLocaleSeo(opts: {
  enabled: boolean;
  baseUrl?: string | null;
  disableMeta?: boolean;
}): boolean {
  return Boolean(opts.enabled && opts.baseUrl && !opts.disableMeta);
}
