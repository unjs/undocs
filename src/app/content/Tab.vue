<script setup lang="ts">
/**
 * Tab
 * ---
 * A leaf inside `<Tabs>`. Its job is to carry a `label`/`title` (+ optional
 * `icon`) prop and hold the panel content in its default slot. `Tabs` reads
 * these props off the child vnodes to build the tab bar and decide which panel
 * to show, so on its own a `Tab` just renders its content in a wrapper `<div>`.
 */
defineProps<{
  label?: string;
  title?: string;
  icon?: string;
}>();
</script>

<template>
  <div class="tab-panel">
    <slot />
  </div>
</template>
