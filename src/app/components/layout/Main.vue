<script setup lang="ts">
// Based on Nuxt UI `UMain` component. Primary `<main>` wrapper sitting under the sticky header.
// `min-height` is also enforced globally in `main.css`; we add vertical rhythm
// so page content never hugs the header/footer.
</script>

<template>
  <main class="flex-1 py-8 lg:py-12">
    <slot />
  </main>
</template>
