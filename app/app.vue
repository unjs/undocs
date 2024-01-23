<script setup lang="ts">
import type { ParsedContent } from '@nuxt/content/dist/runtime/types'

const appConfig = useAppConfig()

const { data: navigation } = await useAsyncData('navigation', () => fetchContentNavigation())

const { data: files } = useLazyFetch<ParsedContent[]>('/api/search.json', {
  default: () => [],
  server: false,
})

useHead({
  // TODO prefer public app icons using https://nuxtseo.com/experiments/guides/app-icons
  link: [{ rel: 'icon', href: appConfig.docs.logo }],
})

const twitterSite = appConfig.docs.socials?.twitter || appConfig.docs.socials?.x || undefined

useSeoMeta({
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
