<script setup lang="ts">
// Based on Nuxt UI's `UPageBody`.
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
