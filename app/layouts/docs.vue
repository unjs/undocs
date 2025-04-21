<script setup lang="ts">
const docsNav = useDocsNav()
</script>

<template>
  <UContainer>
    <UPage :ui="{ left: 'lg:col-span-2 pr-2 border-r border-(--ui-border)' }">
      <template #left>
        <UPageAside>
          <UPageAnchors :links="docsNav.links" />
          <USeparator v-if="docsNav.activeLinks?.length" type="dashed" class="py-6" />
          <UContentNavigation
            :navigation="docsNav.activeLinks"
            default-open
            trailing-icon="i-lucide-chevron-right"
            :ui="{ linkTrailingIcon: 'group-data-[state=open]:rotate-90' }"
            highlight
          />
        </UPageAside>
      </template>
      <slot />
    </UPage>
  </UContainer>
</template>
