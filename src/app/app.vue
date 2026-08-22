<script setup lang="ts">
import { computed, onMounted, provide, watch } from "vue";
import { useRoute } from "@app/router.ts";
import { useAsyncData } from "@app/composables/useAsyncData.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { useHead, useSeoMeta } from "@unhead/vue";
import {
  applyPluginNavigationTree,
  mergePluginHead,
  usePluginContext,
} from "@app/plugins/context.ts";
import { queryNavigation, hintPrerenderRoute } from "@app/composables/useContent.ts";
import { LANDING_KEY, resolveLanding } from "@app/composables/useLanding.ts";
import { docsNavTree } from "@app/utils/nav.ts";
import { findAnchor } from "@app/utils/anchor.ts";
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
const route = useRoute();
const pluginCtx = usePluginContext();

const { data: navigation } = await useAsyncData("navigation", () => queryNavigation());

// Landing on/off — resolved once, here, from the config plus the shape of the
// content tree, and provided to the whole app (`useLanding`). Every consumer
// reads this one answer: `AppLayout` (which layout `/` gets), `pages/index.vue`
// (which page `/` renders), `useSectionTabs`, and the backdrop below.
const landing = computed(() => resolveLanding(appConfig.docs, navigation.value));

// The tree the chrome renders, shaped for that answer — see `docsNavTree`. Every
// consumer (sidebar, section tabs, mobile drawer, search, prefetch) reads this
// one, not the raw response.
const docsNavigation = computed(() =>
  applyPluginNavigationTree(docsNavTree(navigation.value, landing.value), pluginCtx.value),
);

useHead(() => mergePluginHead(pluginCtx.value));

// Bake the global search index (`/api/docs/search`, query-less) too. Unlike
// navigation it isn't fetched during SSR (search loads lazily on open), so the
// prerender recorder never sees it — hint it explicitly here. URL matches
// `querySearchIndex`. No-op outside a prerender pass.
hintPrerenderRoute("/api/docs/search.json");

const twitterSite = appConfig.docs.socials?.twitter || appConfig.docs.socials?.x || undefined;
const browserTabIcon = appConfig.docs?.logo || undefined;

useSeoMeta({
  twitterSite: twitterSite ? `@${twitterSite}` : undefined,
});

useHead({
  htmlAttrs: {
    lang: appConfig.docs.lang || "en",
  },
  link: browserTabIcon
    ? [
        {
          rel: "icon",
          href: browserTabIcon,
          // A bundled icon arrives as a hashed `.svg` URL or, under
          // `assetsInlineLimit`, as a `data:` URI that never ends in `.svg`.
          type:
            browserTabIcon.endsWith(".svg") || browserTabIcon.startsWith("data:image/svg+xml")
              ? "image/svg+xml"
              : undefined,
        },
      ]
    : [],
});

// The fireplace backdrop belongs to the landing only — other pages, including a
// no-landing `/`, get a plain background.
const isLanding = computed(() => route.path === "/" && landing.value);

onMounted(() => {
  watch(
    route,
    () => {
      const hash = window.location.hash;
      if (hash) {
        let attempts = 0;
        const interval = setInterval(() => {
          // `findAnchor` decodes the fragment and swallows an invalid selector
          // (see `utils/anchor.ts`); an uncaught throw here would leak the
          // interval.
          findAnchor(hash)?.scrollIntoView();
          if (attempts++ > 5) {
            clearInterval(interval);
          }
        }, 100);
      }
    },
    { immediate: true },
  );

  // Speculatively warm the `/api/docs/*` requests the top navigation pages need,
  // so client navigations to them are instant. No-op on mobile/slow links.
  startPrefetch(docsNavigation.value, route.path);
});

provide("navigation", docsNavigation);
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
      <!-- Full-bleed: an announcement strip reads as being addressed to the
           viewport, not to the page, so it stays outside the box. -->
      <Banner v-if="appConfig.docs.banner?.title" v-bind="appConfig.docs.banner" />

      <!-- The full-bleed page shell. It sets no width of its own — each piece
           of chrome caps its content at `--ui-container` via `Container`, so
           the horizontal rules run to the viewport while the content stays in
           a centred column. -->
      <GridPage>
        <!-- Parented to the shell, not to `<main>`: it spans the full page
             height — up behind the (transparent-at-rest,
             blurred-when-scrolled) header and down through the sections. -->
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
