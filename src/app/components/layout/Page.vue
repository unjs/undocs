<script setup lang="ts">
import { cn } from "@app/utils/cn";
// Based on Nuxt UI `UPage` component. Responsive docs grid with optional `#left` (sidebar) and
// `#right` (TOC aside) slots plus the default (main content) slot.
//
// The grid is a 10-column track on `lg+`:
//   - left  → `lg:col-span-2` (overridable via `ui.left`)
//   - right → `lg:col-span-2`
//   - main  → fills the remaining columns (8 / 6)
//
// Instances nest: `layouts/docs.vue` renders a `Page` with only `#left`, and its
// default slot contains `pages/[...slug].vue`'s `Page` which has only `#right`.
//
// Slot presence is read from `$slots` directly in the template (not cached in a
// `computed`) so it re-evaluates on every render — layouts toggle `#left` on
// client-side navigation, and the internal slots object isn't a reactive
// dependency a `computed` would track.
const props = defineProps<{
  ui?: {
    left?: string;
    [key: string]: any;
  };
}>();
</script>

<template>
  <div :class="$slots.left || $slots.right ? 'lg:grid lg:grid-cols-10 lg:gap-8' : ''">
    <aside v-if="$slots.left" :class="cn('lg:col-span-2', props.ui?.left)">
      <slot name="left" />
    </aside>

    <div
      :class="
        cn(
          'min-w-0',
          $slots.left && $slots.right
            ? 'lg:col-span-6'
            : $slots.left || $slots.right
              ? 'lg:col-span-8'
              : '',
        )
      "
    >
      <slot />
    </div>

    <div v-if="$slots.right" class="lg:col-span-2">
      <slot name="right" />
    </div>
  </div>
</template>
