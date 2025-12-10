<script setup lang="ts">
import type { BannerProps } from '@nuxt/ui'

const appConfig = useAppConfig()

const { data: navigation } = await useAsyncData('navigation', () => queryCollectionNavigation('content'))
const { data: files } = useLazyAsyncData('search', () => queryCollectionSearchSections('content'), {
  server: false,
})

const twitterSite = appConfig.docs.socials?.twitter || appConfig.docs.socials?.x || undefined
const browserTabIcon = appConfig.docs?.logo || undefined

useSeoMeta({
  twitterSite: twitterSite ? `@${twitterSite}` : undefined,
})

useHead({
  htmlAttrs: {
    lang: appConfig.docs.lang || 'en',
  },
  link: [
    {
      rel: 'icon',
      href: browserTabIcon,
    },
  ],
})

const route = useRoute()

onMounted(() => {
  watch(
    route,
    () => {
      const hash = window.location.hash
      if (hash) {
        let attempts = 0
        const interval = setInterval(() => {
          document.querySelector(hash)?.scrollIntoView()
          if (attempts++ > 5) {
            clearInterval(interval)
          }
        }, 100)
      }
    },
    { immediate: true },
  )
})

provide('navigation', navigation)
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator color="var(--ui-primary)" />
    <UBanner v-if="appConfig.docs.banner?.title" v-bind="appConfig.docs.banner as BannerProps" />
    <AppHeader />

    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UMain>

    <AppFooter />

    <ClientOnly>
      <LazyUContentSearch :files="files" :navigation="navigation" shortcut="meta_k" />
    </ClientOnly>
  </UApp>
</template>
