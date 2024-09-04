<script setup lang="ts">
// import type { NavItem } from '@nuxt/content/dist/runtime/types'

// const navigation = inject<NavItem[]>('navigation', [])

const appConfig = useAppConfig()

const metaSymbol = useShortcuts().metaSymbol

const docsNav = useDocsNav()

const headerLinks = computed(() => {
  return [
    ...docsNav.links
      .filter((link) => link.hasIndex)
      .map((link) => {
        return {
          ...link,
          children: undefined,
          // children: link.children?.filter((child) => !child.children || child.children.some((c) => c.to === child.to)),
        }
      }),
  ]
})
</script>

<template>
  <UHeader
    :ui="{
      wrapper: 'bg-background/75 backdrop-blur border-b border-gray-200 dark:border-gray-700 -mb-px sticky top-0 z-50',
      left: 'lg:flex-4 flex items-center gap-1.5',
    }"
  >
    <!-- Left -->
    <template #left>
      <!-- Logo -->
      <NuxtLink
        to="/"
        class="flex-shrink-0 font-bold text-xl text-gray-900 dark:text-white flex items-end gap-1.5 mr-5"
      >
        <img :src="appConfig.docs.logo" :alt="`${appConfig.site.name} logo`" class="h-7 w-7" />
        <span>
          {{ appConfig.site.name }}
        </span>
      </NuxtLink>
    </template>

    <!-- Center -->
    <template #center>
      <!-- Nav links -->
      <UHeaderLinks v-if="headerLinks.length > 1" :links="headerLinks" class="hidden md:flex mr-4"> </UHeaderLinks>
    </template>

    <!-- Right -->
    <template #right>
      <UTooltip text="Search" :shortcuts="[metaSymbol, 'K']">
        <UContentSearchButton :label="null" />
      </UTooltip>
      <!-- <div class="flex items-center border-l border-slate-200 ml-6 pl-6 dark:border-slate-800"> -->
      <UColorModeButton />
      <SocialButtons />
      <!-- </div> -->
    </template>

    <template #panel>
      <UNavigationTree :links="docsNav.links" default-open :multiple="false" />
    </template>
  </UHeader>
</template>
