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

const iconLogo = '/icon.svg'
</script>

<template>
  <UHeader :ui="{ logo: 'items-center' }" :links="mapContentNavigation(navigation)">
    <template #logo>
      <img :src="iconLogo" :alt="`${appConfig.site.name} logo`" class="h-7 w-7" />
      <span>
        {{ appConfig.site.name }}
      </span>
      <UBadge v-if="tag" :label="tag" color="primary" variant="subtle" size="xs" />
    </template>

    <template #center>
      <UDocsSearchButton class="hidden lg:flex" />
    </template>

    <template #right>
      <UTooltip v-if="stars" class="hidden lg:flex" :text="`${appConfig.site.name} GitHub Stars`">
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
