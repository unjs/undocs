<script setup lang="ts">
import type { NavItem } from '@nuxt/content/dist/runtime/types'

const navigation = inject<Ref<NavItem[]>>('navigation')

const navigationLinks = computed(() => {
  return mapContentNavigation(navigation.value).map((item) => {
    if (item.children?.length === 1) {
      return {
        ...item,
        ...item.children[0],
        children: undefined,
      }
    }
    return item
  })
})
</script>

<template>
  <UNavigationTree :links="navigationLinks" default-open :multiple="false" />
</template>
