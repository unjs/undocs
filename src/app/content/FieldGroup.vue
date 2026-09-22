<script setup lang="ts">
/**
 * `::field-group` — stacks `::field`s with a divider between each. Mirrors Nuxt
 * UI's `ProseFieldGroup`.
 */
</script>

<template>
  <div class="field-group my-5 divide-y divide-border">
    <slot />
  </div>
</template>

<style scoped>
/* Space fields by padding (so the divider sits midway), not their own margin. */
.field-group > :deep(*) {
  margin-top: 0;
  margin-bottom: 0;
  padding-top: 1.25rem;
  padding-bottom: 1.25rem;
}
.field-group > :deep(:first-child) {
  padding-top: 0;
}
.field-group > :deep(:last-child) {
  padding-bottom: 0;
}
</style>
