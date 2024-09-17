<script setup lang="ts">
import type { ParsedContent } from '@nuxt/content/dist/runtime/types'

const appConfig = useAppConfig()

const { data: navigation } = await useAsyncData('navigation', () => fetchContentNavigation())

const { data: files } = useLazyFetch<ParsedContent[]>('/api/search.json', {
  default: () => [],
  server: false,
})

const twitterSite = appConfig.docs.socials?.twitter || appConfig.docs.socials?.x || undefined

const browserTabIcon = appConfig.docs?.logo || undefined

useSeoMeta({
  twitterSite: twitterSite ? `@${twitterSite}` : undefined,
})

useHead({
  link: [
    {
      rel: 'icon',
      href: browserTabIcon,
    },
  ],
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
code {
  border: none !important;
  font-weight: normal !important;
}
</style>
