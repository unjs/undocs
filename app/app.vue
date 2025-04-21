<script setup lang="ts">
const appConfig = useAppConfig()

const { data: navigation } = await useAsyncData('navigation', () => queryCollectionNavigation('content'))
const { data: files } = useLazyAsyncData('search', () => queryCollectionSearchSections('content'), {
  server: false
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
  <UApp>
    <NuxtLoadingIndicator color="var(--ui-primary)" />
    <AppHeader />

    <UMain class="min-h-[calc(100vh-var(--header-height)-78px)]">
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
