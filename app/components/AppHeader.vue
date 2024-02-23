<script setup lang="ts">
import type { NavItem } from '@nuxt/content/dist/runtime/types'

const navigation = inject<NavItem[]>('navigation', [])

const appConfig = useAppConfig()

const { metaSymbol } = useShortcuts()

const route = useRoute()

const navLinks = computed(() => {
  // console.log(mapContentNavigation(navigation.value))
  // console.log(JSON.parse(JSON.stringify(navigation.value, null, 2)))
  return navigation.value
    .map((nav) => {
      if (!nav.children?.find((c) => c._path === nav._path)) {
        return
      }
      return {
        label: toLabel(nav._path.substring(1)),
        to: nav._path,
        active: route.path.startsWith(nav._path),
      }
    })
    .filter(Boolean)
})
</script>

<template>
  <UHeader>
    <template #left>
      <NuxtLink to="/" class="flex-shrink-0 font-bold text-xl text-gray-900 dark:text-white flex items-end gap-1.5">
        <img :src="appConfig.docs.logo" :alt="`${appConfig.site.name} logo`" class="h-7 w-7" />
        <span>
          {{ appConfig.site.name }}
        </span>
      </NuxtLink>
    </template>

    <template #center>
      <UContentSearchButton label="Search..." class="hidden lg:flex" />
    </template>

    <template #right>
      <UHeaderLinks :links="navLinks" class="mr-4" v-if="navLinks.length > 1" />

      <UTooltip class="lg:hidden" text="Search" :shortcuts="[metaSymbol, 'K']">
        <UContentSearchButton :label="null" />
      </UTooltip>

      <!-- <ColorPicker /> -->

      <SocialButtons :socials="['github']" />
    </template>

    <template #panel>
      <UNavigationTree :links="mapContentNavigation(navigation)" />
    </template>
  </UHeader>
</template>
