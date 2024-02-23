<script setup lang="ts">
const docsNav = useDocsNav()
</script>

<template>
  <UContainer>
    <UPage>
      <template #left>
        <UAside :links="docsNav.links">
          <UDivider type="dashed" class="mb-6" v-if="docsNav.activeLinks?.length" />
          <UNavigationTree :links="docsNav.activeLinks" />
        </UAside>
      </template>
      <slot />
    </UPage>
  </UContainer>
</template>
