<script setup lang="ts">
/**
 * `::field` — one documented option: its name in monospace, the type as a muted
 * badge, and the description (the default slot, or the `description` prop)
 * underneath. Mirrors Nuxt UI's `ProseField` API (`name`, `type`,
 * `description`, `required`) so docs written for the old theme render as-is.
 * Grouped by `::field-group`, which draws the dividers. The name and badges are
 * `<span>`s, not `<code>`: `.md :not(pre) > code` would out-specify their classes.
 */
defineProps<{
  name?: string;
  type?: string;
  description?: string;
  required?: boolean;
  [key: string]: unknown;
}>();
</script>

<template>
  <div class="field my-5">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span v-if="name" class="font-mono text-copy-14 font-semibold text-foreground">{{
        name
      }}</span>
      <span v-if="type || required" class="flex flex-wrap items-center gap-1.5">
        <span
          v-if="required"
          class="rounded-sm bg-danger-tint px-1.5 py-0.5 font-mono text-label-12 text-danger"
          >required</span
        >
        <span
          v-if="type"
          class="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-label-12 text-muted-foreground"
          >{{ type }}</span
        >
      </span>
    </div>
    <div
      v-if="$slots.default || description"
      class="field-body mt-2 text-copy-14 text-muted-foreground"
    >
      <slot>{{ description }}</slot>
    </div>
  </div>
</template>

<style scoped>
/* The body is prose; trim its edge margins so it sits flush under the name. */
.field-body :deep(> :first-child) {
  margin-top: 0;
}
.field-body :deep(> :last-child) {
  margin-bottom: 0;
}
</style>
