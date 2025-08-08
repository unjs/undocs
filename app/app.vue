<script setup lang="ts">
const appConfig = useAppConfig()

const { data: navigation } = await useAsyncData('navigation', () => queryCollectionNavigation('content'))
const { data: files } = useLazyAsyncData('search', () => queryCollectionSearchSections('content'), {
  server: false,
})

const twitterSite = appConfig.docs.socials?.twitter || appConfig.docs.socials?.x || undefined
const browserTabIcon = appConfig.docs?.logo || undefined

const scripts = appConfig.docs?.scripts || []

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

if (scripts.length > 0) {
  useHead({
    script: scripts,
  })
}

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
