<script setup lang="ts">
import type { ParsedContent } from '@nuxt/content/dist/runtime/types'

const appConfig = useAppConfig()

const { data: navigation } = await useAsyncData('navigation', () => fetchContentNavigation())

const { data: files } = useLazyFetch<ParsedContent[]>('/api/search.json', {
  default: () => [],
  server: false,
})

// const separator = "·";
const defaultLang = 'en'
const dir = 'ltr'

useHead({
  htmlAttrs: {
    lang: defaultLang,
    dir,
    class: 'scroll-smooth',
  },
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
  ],
  link: [{ rel: 'icon', href: appConfig.docs.logo }],
})

useSeoMeta({
  ogType: 'website',
  ogSiteName: appConfig.docs.name,
  twitterCard: 'summary_large_image',
  twitterSite: appConfig.docs.socials?.twitter || appConfig.docs.socials?.x || undefined,
})

provide('navigation', navigation)
</script>

<template>
  <div>
    <AppHeader />

    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UMain>

    <AppFooter />

    <ClientOnly>
      <LazyUDocsSearch :files="files" :navigation="navigation" />
    </ClientOnly>

    <UNotifications />
  </div>
</template>
