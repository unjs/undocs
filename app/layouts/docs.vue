<script setup lang="ts">
const docsNav = useDocsNav();
</script>

<template>
  <UContainer>
    <UPage :ui="{ left: 'lg:col-span-2 pr-2 border-r border-default' }">
      <template #left>
        <UPageAside>
          <UPageAnchors :links="docsNav.links.filter((l) => l.title !== 'Blog')" />
          <USeparator v-if="docsNav.activeLinks?.length" type="dashed" class="py-6" />
          <UContentNavigation :navigation="docsNav.activeLinks" :collapsible="false" />
        </UPageAside>
      </template>
      <slot />
    </UPage>
  </UContainer>
</template>
