<script setup lang="ts">
import { computed, onMounted, provide, watch } from "vue";
import { useRoute } from "@app/router";
import { useAsyncData } from "@app/composables/useAsyncData";
import { useAppConfig } from "@app/composables/useAppConfig";
import { useHead, useSeoMeta } from "@unhead/vue";
import { queryNavigation, hintPrerenderRoute } from "@app/composables/useContent";
import AppFooter from "@app/components/app/AppFooter.vue";
import AppHeader from "@app/components/app/AppHeader.vue";
import AuraBackground from "@app/components/AuraBackground.vue";
import AppProvider from "@app/components/ui/AppProvider.vue";
import Banner from "@app/components/ui/Banner.vue";
import StatusBanner from "@app/components/ui/StatusBanner.vue";
import Main from "@app/components/layout/Main.vue";
import DocsSearch from "@app/components/docs/DocsSearch.vue";
import NavLoadingBar from "@app/components/NavLoadingBar.vue";
import ClientOnly from "@app/components/app/ClientOnly";
import AppLayout from "@app/components/app/AppLayout";
import AppPage from "@app/components/app/AppPage";
import { startPrefetch } from "@app/prefetch";
const appConfig = useAppConfig();

const { data: navigation } = await useAsyncData("navigation", () => queryNavigation());

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
  link: [
    {
      rel: "icon",
      href: browserTabIcon,
    },
  ],
});

const route = useRoute();

// Landing gets the richer hero aura; every other page a subtler top strip.
const auraVariant = computed(() => (route.path === "/" ? "hero" : "docs"));

onMounted(() => {
  watch(
    route,
    () => {
      const hash = window.location.hash;
      if (hash) {
        let attempts = 0;
        const interval = setInterval(() => {
          document.querySelector(hash)?.scrollIntoView();
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
  startPrefetch(navigation.value ?? [], route.path);
});

provide("navigation", navigation);
</script>

<template>
  <AppProvider>
    <div class="relative isolate">
      <AuraBackground :variant="auraVariant" />
      <ClientOnly>
        <NavLoadingBar />
      </ClientOnly>
      <ClientOnly>
        <StatusBanner variant="offline" />
      </ClientOnly>
      <Banner v-if="appConfig.docs.banner?.title" v-bind="appConfig.docs.banner" />
      <AppHeader />

      <Main>
        <AppLayout>
          <AppPage />
        </AppLayout>
      </Main>

      <AppFooter />

      <ClientOnly>
        <DocsSearch :navigation="navigation" shortcut="meta_k" />
      </ClientOnly>
    </div>
  </AppProvider>
</template>
