<script setup lang="ts">
const docsNav = useDocsNav()
</script>

<template>
  <UContainer>
    <UPage :ui="{ left: 'lg:col-span-2 pr-2 border-r border-gray-200 dark:border-gray-700' }">
      <template #left>
        <UAside :links="docsNav.links">
          <UDivider v-if="docsNav.activeLinks?.length" type="dashed" class="mb-6" />
          <UNavigationTree :links="docsNav.activeLinks" />
        </UAside>
      </template>
      <slot />
    </UPage>
  </UContainer>
</template>
