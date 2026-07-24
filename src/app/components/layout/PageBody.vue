<script setup lang="ts">
// Based on Nuxt UI `UPageBody` component. Content wrapper. When `prose` is set, wraps the slot in
// `<div class="md">` so the prose styles (which target `.md`) apply. A passed
// `class` falls through onto the root (Vue attr fallthrough), so
// `<PageBody prose class="break-words">` → `class="md break-words"`.
defineProps<{
  prose?: boolean;
}>();
</script>

<template>
  <div v-if="prose" class="md">
    <slot />
  </div>
  <div v-else>
    <slot />
  </div>
</template>
