<script setup lang="ts">
import type { NavItem } from '@nuxt/content/dist/runtime/types'
import { trainCase } from 'scule'

const navigation = inject<NavItem[]>('navigation', [])

const appConfig = useAppConfig()

const { metaSymbol } = useShortcuts()

const navLinks = computed(() => {
  // console.log(mapContentNavigation(navigation.value))
  return navigation.value.map(nav => {
    let label = trainCase(nav._path.substring(1)).replaceAll("-", ' ')
    if (label === 'Api') {
      label = 'API'
    }
    return {
      label,
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
      <!-- Search -->
      <UTooltip text="Search" :shortcuts="[metaSymbol, 'K']">
        <UDocsSearchButton :label="null" />
      </UTooltip>

      <!-- Color Stuff -->
      <ColorPicker />

      <!-- Github -->
      <UTooltip :text="`View ${appConfig.docs.github} in GitHub`">
        <UButton
        :to="`https://github.com/${appConfig.docs.github}`"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
          v-bind="($ui.button.secondary as any)"
        />
      </UTooltip>


    </template>

    <template #panel>
      <UNavigationTree :links="mapContentNavigation(navigation)" />
    </template>
  </UHeader>
</template>
