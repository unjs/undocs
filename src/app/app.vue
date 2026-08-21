<script setup lang="ts">
import { computed, onMounted, provide, watch } from "vue";
import { useRoute } from "@app/router.ts";
import { useAsyncData } from "@app/composables/useAsyncData.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { useLocaleDocsConfig, applyNavPatch } from "@app/composables/useLocaleDocsConfig.ts";
import { provideI18nDisableMeta } from "@app/composables/useI18nDisableMeta.ts";
import { useHead, useSeoMeta } from "@unhead/vue";
import { queryNavigation, hintPrerenderRoute } from "@app/composables/useContent.ts";
import { LANDING_KEY, resolveLanding } from "@app/composables/useLanding.ts";
import { docsNavTree } from "@app/utils/nav.ts";
import {
  filterNavByLocale,
  getLocaleFromPath,
  localeAlternatePath,
  localeHomePath,
  pageRouteForLocale,
  resolveI18nConfig,
  routeNameFromPath,
  shouldEmitLocaleSeo,
} from "@app/utils/locale.ts";
import { findAnchor } from "@app/utils/anchor.ts";
import { useI18n, useLocaleHead } from "@i18n-micro/vue";
import AppFooter from "@app/components/app/AppFooter.vue";
import AppHeader from "@app/components/app/AppHeader.vue";
import FireplaceBackground from "@app/components/FireplaceBackground.vue";
import GridPage from "@app/components/grid/GridPage.vue";
import AppProvider from "@app/components/ui/AppProvider.vue";
import Banner from "@app/components/ui/Banner.vue";
import StatusBanner from "@app/components/ui/StatusBanner.vue";
import Main from "@app/components/layout/Main.vue";
import DocsSearch from "@app/components/docs/DocsSearch.vue";
import NavLoadingBar from "@app/components/NavLoadingBar.vue";
import ClientOnly from "@app/components/app/ClientOnly.ts";
import AppLayout from "@app/components/app/AppLayout.ts";
import AppPage from "@app/components/app/AppPage.ts";
import { startPrefetch } from "@app/prefetch.ts";

const appConfig = useAppConfig();
const localeDocs = useLocaleDocsConfig();
const i18nConfig = resolveI18nConfig(appConfig.docs as { lang?: string; i18n?: any });
const i18n = i18nConfig.enabled ? useI18n() : null;
const pageRoutes = (appConfig.docs as { _i18nPageRoutes?: Record<string, string[]> | string[] })
  ._i18nPageRoutes;

const route = useRoute();
const disableMeta = provideI18nDisableMeta(false);

watch(
  () => route.path,
  () => {
    disableMeta.value = false;
  },
);

const currentLocale = computed(() =>
  getLocaleFromPath(
    route.path,
    i18nConfig.localeCodes,
    i18nConfig.defaultLocale,
    i18nConfig.strategy,
  ),
);

const localeHome = computed(() =>
  localeHomePath(currentLocale.value, i18nConfig.defaultLocale, i18nConfig.strategy),
);

const htmlLang = computed(() => {
  const loc = i18nConfig.locales.find((l) => l.code === currentLocale.value);
  return loc?.iso || currentLocale.value || appConfig.docs.lang || "en";
});

const baseUrl = appConfig.site.url || undefined;
const emitLocaleSeo = computed(() =>
  shouldEmitLocaleSeo({
    enabled: i18nConfig.enabled,
    baseUrl,
    disableMeta: disableMeta.value,
  }),
);

// Keep @i18n-micro/vue locale + page route dict in sync with the URL.
watch(
  [currentLocale, () => route.path],
  ([code, path]) => {
    if (!i18n) return;
    if (i18n.locale.value !== code) i18n.locale.value = code;
    const derived = routeNameFromPath(path as string, i18nConfig.localeCodes);
    i18n.setRoute(pageRouteForLocale(derived, code as string, pageRoutes));
  },
  { immediate: true },
);

const { data: navigation } = await useAsyncData("navigation", () => queryNavigation());

const localeNavigation = computed(() => {
  const filtered = filterNavByLocale(
    navigation.value,
    currentLocale.value,
    i18nConfig.defaultLocale,
    i18nConfig.localeCodes,
  );
  const navOverride = localeDocs.value.navigation;
  if (Array.isArray(navOverride)) return navOverride as typeof filtered;
  if (navOverride && typeof navOverride === "object") {
    return applyNavPatch(
      filtered,
      navOverride as Record<string, { title?: string; hide?: boolean }>,
    );
  }
  return filtered;
});

const landing = computed(() => resolveLanding(localeDocs.value, localeNavigation.value));

const docsNavigation = computed(() => docsNavTree(localeNavigation.value, landing.value));

hintPrerenderRoute("/api/docs/search.json");

const twitterSite = appConfig.docs.socials?.twitter || appConfig.docs.socials?.x || undefined;
const browserTabIcon = appConfig.docs?.logo || undefined;

useSeoMeta({
  twitterSite: twitterSite ? `@${twitterSite}` : undefined,
});

useHead({
  link: browserTabIcon
    ? [
        {
          rel: "icon",
          href: browserTabIcon,
          type:
            browserTabIcon.endsWith(".svg") || browserTabIcon.startsWith("data:image/svg+xml")
              ? "image/svg+xml"
              : undefined,
        },
      ]
    : [],
});

if (i18nConfig.enabled && i18n) {
  const { metaObject, updateMeta } = useLocaleHead({
    addSeoAttributes: Boolean(baseUrl),
    addDirAttribute: false,
    baseUrl: baseUrl || "/",
  });

  watch(
    [() => route.fullPath, currentLocale, emitLocaleSeo, navigation],
    () => {
      updateMeta();
    },
    { immediate: true },
  );

  /** Rewrite hreflang hrefs to existence-aware paths (same as LocaleSwitcher). */
  const localeLinks = computed(() => {
    if (!emitLocaleSeo.value || !baseUrl) return [];
    const raw = metaObject.value?.link ?? [];
    return raw.map((entry: Record<string, string>) => {
      if (entry.rel !== "alternate" || !entry.hreflang || !entry.href) return entry;
      const code =
        entry.hreflang === "x-default"
          ? i18nConfig.defaultLocale
          : i18nConfig.locales.find((l) => l.iso === entry.hreflang || l.code === entry.hreflang)
              ?.code;
      if (!code) return entry;
      const altPath = localeAlternatePath(route.path, code, navigation.value, i18nConfig);
      try {
        const url = new URL(entry.href);
        url.pathname = altPath;
        return { ...entry, href: url.href };
      } catch {
        return { ...entry, href: altPath };
      }
    });
  });

  useHead({
    htmlAttrs: computed(() => {
      const attrs = metaObject.value?.htmlAttrs;
      return attrs ? { ...attrs, lang: attrs.lang || htmlLang.value } : { lang: htmlLang.value };
    }),
    link: localeLinks,
    meta: computed(() => (emitLocaleSeo.value ? (metaObject.value?.meta ?? []) : [])),
  });
} else {
  useHead({
    htmlAttrs: {
      lang: htmlLang,
    },
  });
}

const isLanding = computed(() => landing.value && route.path === localeHome.value);

const bannerProps = computed(() => localeDocs.value.banner);

onMounted(() => {
  watch(
    route,
    () => {
      const hash = window.location.hash;
      if (hash) {
        let attempts = 0;
        const interval = setInterval(() => {
          findAnchor(hash)?.scrollIntoView();
          if (attempts++ > 5) {
            clearInterval(interval);
          }
        }, 100);
      }
    },
    { immediate: true },
  );

  startPrefetch(docsNavigation.value, route.path);
});

provide("navigation", docsNavigation);
provide("rawNavigation", navigation);
provide(LANDING_KEY, landing);
</script>

<template>
  <AppProvider>
    <div class="relative isolate">
      <ClientOnly>
        <NavLoadingBar />
      </ClientOnly>
      <ClientOnly>
        <StatusBanner variant="offline" />
      </ClientOnly>
      <Banner v-if="bannerProps?.title" v-bind="bannerProps" />

      <GridPage>
        <FireplaceBackground v-if="isLanding" />

        <AppHeader />

        <Main>
          <AppLayout>
            <AppPage />
          </AppLayout>
        </Main>

        <AppFooter />
      </GridPage>

      <ClientOnly>
        <DocsSearch :navigation="docsNavigation" shortcut="meta_k" />
      </ClientOnly>
    </div>
  </AppProvider>
</template>
