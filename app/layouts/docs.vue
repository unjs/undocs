<script setup lang="ts">
const docsNav = useDocsNav()
</script>

<template>
  <UContainer>
    <UPage :ui="{ left: 'lg:col-span-2 pr-2 border-r border-(--ui-border)' }">
      <template #left>
        <UPageAside :links="docsNav.links">
          <USeparator v-if="docsNav.activeLinks?.length" type="dashed" class="mb-6" />
          <UContentNavigation :navigation="docsNav.activeLinks" />
        </UPageAside>
      </template>
      <slot />
    </UPage>
  </UContainer>
</template>
