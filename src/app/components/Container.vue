<script setup lang="ts">
// Based on Nuxt UI `UContainer` component. Centered max-width wrapper. `--ui-container` = 90rem
// (defined in `main.css`).
</script>

<template>
  <div class="mx-auto w-full max-w-[var(--ui-container)] px-4 sm:px-6 lg:px-8">
    <slot />
  </div>
</template>
