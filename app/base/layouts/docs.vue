<script setup lang="ts">
const docsNav = useDocsNav()
</script>

<template>
  <UContainer>
    <UPage>
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
