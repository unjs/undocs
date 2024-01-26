<script setup lang="ts">
import type { NavItem } from '@nuxt/content/dist/runtime/types'

const navigation = inject<NavItem[]>('navigation', [])

const appConfig = useAppConfig()

const [{ data: stars }, { data: tag }] = await Promise.all([
  useFetch(`https://ungh.cc/repos/${appConfig.docs.github}`, {
    transform: (data: any) => data.repo.stars as number,
  }),
  useFetch(`https://ungh.cc/repos/${appConfig.docs.github}/releases/latest`, {
    transform: (data: any) => data.release.tag as string,
  }),
])

const { metaSymbol } = useShortcuts()
</script>

<template>
  <UHeader :ui="{ logo: 'items-center' }" :links="mapContentNavigation(navigation)">
    <template #logo>
      <img :src="appConfig.docs.logo" :alt="`${appConfig.docs.name} logo`" class="h-7 w-7" />
      <span>
        {{ appConfig.docs.name }}
      </span>
      <UBadge v-if="tag" :label="tag as string" color="primary" variant="subtle" size="xs" />
    </template>

    <template #center>
      <UDocsSearchButton class="hidden lg:flex" />
    </template>

    <template #right>
      <UTooltip class="lg:hidden" text="Search" :shortcuts="[metaSymbol, 'K']">
        <UDocsSearchButton :label="null" />
      </UTooltip>
      <UTooltip v-if="stars" class="hidden lg:flex" :text="`${appConfig.docs.name} GitHub Stars`">
        <UButton
          icon="i-simple-icons-github"
          :to="`https://github.com/${appConfig.docs.github}`"
          target="_blank"
          aria-label="Visit repository"
          square
          color="gray"
          variant="ghost"
        >
          {{ formatNumber(stars) }}
        </UButton>
      </UTooltip>
    </template>

    <template #panel>
      <UNavigationTree :links="mapContentNavigation(navigation)" />
    </template>
  </UHeader>
</template>
