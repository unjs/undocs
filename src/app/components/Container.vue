<script setup lang="ts">
// Based on Nuxt UI `UContainer` component. Centered max-width wrapper.
// `--ui-container` is defined in `main.css` and STEPS with the viewport
// (76.25rem → 88rem at 1440px → 96rem at 1920px), so this stays one declaration
// and every piece of chrome using it widens in lockstep.
</script>

<template>
  <div class="mx-auto w-full max-w-[var(--ui-container)] px-4 sm:px-6 lg:px-8">
    <slot />
  </div>
</template>
