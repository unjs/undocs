<script setup lang="ts">
import type { ParsedContent } from '@nuxt/content/dist/runtime/types'

const appConfig = useAppConfig()

const { data: navigation } = await useAsyncData('navigation', () => fetchContentNavigation())

const { data: files } = useLazyFetch<ParsedContent[]>('/api/search.json', {
  default: () => [],
  server: false,
})

const links = [{
  label: 'Changlog',
  icon: 'solar:notes-minimalistic-bold-duotone',
  to: '/changelog'
}]

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
    <LazyUContentSearch :files="files" :navigation="navigation" :links="links" />
  </ClientOnly>

  <UNotifications />
</template>
