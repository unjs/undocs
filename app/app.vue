<script setup lang="ts">
import { _theme } from '#tailwind-config/theme/colors'
import type { ParsedContent } from '@nuxt/content/dist/runtime/types'

const appConfig = useAppConfig()

const { data: navigation } = await useAsyncData('navigation', () => fetchContentNavigation())

const { data: files } = useLazyFetch<ParsedContent[]>('/api/search.json', {
  default: () => [],
  server: false,
})

const site = useSiteConfig()

useHead({
  titleTemplate: title => title ? `${title} ${site.separator} ${site.name}` : `${site.name}: ${site.description}`,
  htmlAttrs: {
    lang: site.defaultLang,
    dir: 'ltr',
    class: 'scroll-smooth',
  },
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'theme-color', content: _theme[500] },
  ],
  link: [{ rel: 'icon', href: '/icon.svg' }],
})

const twitterSite = appConfig.docs.socials?.twitter || appConfig.docs.socials?.x || undefined

useSeoMeta({
  ogType: 'website',
  ogSiteName: site.name,
  twitterCard: 'summary_large_image',
  twitterSite: twitterSite ? `@${twitterSite}` : undefined,
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
