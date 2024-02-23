<script setup lang="ts">
import type { NavItem } from '@nuxt/content/dist/runtime/types'

const navigation = inject<NavItem[]>('navigation', [])

const appConfig = useAppConfig()

const { metaSymbol } = useShortcuts()

const docsNav = useDocsNav()

const headerLinks = computed(() => {
  return docsNav.links
    .filter((link) => link.hasIndex)
    .map((link) => {
      return {
        ...link,
        children: link.children?.filter((child) => !child.children || child.children.some((c) => c.to === child.to)),
      }
    })
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

      <div class="ml-8 lg:flex hidden">
        <UContentSearchButton label="Search..." />
      </div>
    </template>

    <!-- <template #center>
      <UContentSearchButton label="Search..." class="lg:flex hidden" />
    </template> -->

    <template #right>
      <UHeaderLinks :links="headerLinks" class="hidden md:flex mr-4" v-if="docsNav.links.length > 1" />

      <UTooltip class="lg:hidden" text="Search" :shortcuts="[metaSymbol, 'K']">
        <UContentSearchButton :label="null" />
      </UTooltip>

      <ColorPicker />

      <SocialButtons />
    </template>

    <template #panel>
      <UNavigationTree :links="docsNav.links" default-open :multiple="false" />
    </template>
  </UHeader>
</template>
