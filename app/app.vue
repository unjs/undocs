<script setup lang="ts">
import type { ParsedContent } from '@nuxt/content/dist/runtime/types'

const appConfig = useAppConfig()

const { data: navigation } = await useAsyncData('navigation', () => fetchContentNavigation())

const { data: files } = useLazyFetch<ParsedContent[]>('/api/search.json', {
  default: () => [],
  server: false,
})

const twitterSite = appConfig.docs.socials?.twitter || appConfig.docs.socials?.x || undefined

useSeoMeta({
  twitterSite: twitterSite ? `@${twitterSite}` : undefined,
})

provide('navigation', navigation)
</script>

<template>
  <NuxtLoadingIndicator color="rgb(252,211,77)" />
  <AppHeader />

  <UMain class="min-h-[calc(100vh-var(--header-height)-78px)]">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UMain>

  <AppFooter />

  <ClientOnly>
    <LazyUContentSearch :files="files" :navigation="navigation" />
  </ClientOnly>

  <UNotifications />
</template>

<style>
code.shiki {
  background-color: transparent !important;
}

html.dark .shiki,
html.dark .shiki span {
  color: var(--shiki-dark) !important;
  font-style: var(--shiki-dark-font-style) !important;
  font-weight: var(--shiki-dark-font-weight) !important;
  text-decoration: var(--shiki-dark-text-decoration) !important;
}
</style>
