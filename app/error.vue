<script setup lang="ts">
import type { NuxtError } from "#app";

useSeoMeta({
  title: "Page not found",
  description: "We are sorry but this page could not be found.",
});

defineProps<{
  error: NuxtError;
}>();

useHead({
  htmlAttrs: {
    lang: "en",
  },
});

const { data: navigation } = await useAsyncData("navigation", () =>
  queryCollectionNavigation("content"),
);
const { data: files } = useLazyAsyncData("search", () => queryCollectionSearchSections("content"), {
  server: false,
});

provide("navigation", navigation);
</script>

<template>
  <UApp>
    <AppHeader />

    <UMain>
      <UContainer>
        <UPage>
          <UError :error="error" />
        </UPage>
      </UContainer>
    </UMain>

    <AppFooter />

    <ClientOnly>
      <LazyUContentSearch :files="files" :navigation="navigation" shortcut="meta_k" />
    </ClientOnly>
  </UApp>
</template>
