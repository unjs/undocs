<script setup lang="ts">
import type { NavItem } from '@nuxt/content/dist/runtime/types'

const navigation = inject<NavItem[]>('navigation', [])

const appConfig = useAppConfig()

const { metaSymbol } = useShortcuts()

const navLinks = computed(() => {
  // console.log(mapContentNavigation(navigation.value))
  return navigation.value.map((nav) => {
    return {
      label: toLabel(nav._path.substring(1)),
      to: nav._path,
    }
  })
})
</script>

<template>
  <UHeader :links="navLinks">
    <template #logo>
      <img :src="appConfig.docs.logo" :alt="`${appConfig.site.name} logo`" class="h-7 w-7" />
      <span>
        {{ appConfig.site.name }}
      </span>
    </template>

    <template #center>
      <!-- <UDocsSearchButton class="hidden lg:flex" /> -->
    </template>

    <template #right>
      <UTooltip text="Search" :shortcuts="[metaSymbol, 'K']">
        <UDocsSearchButton :label="null" />
      </UTooltip>
      <SocialButtons />
    </template>

    <template #panel>
      <UNavigationTree :links="mapContentNavigation(navigation)" />
    </template>
  </UHeader>
</template>
