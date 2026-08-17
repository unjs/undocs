<script setup lang="ts">
import { cn } from "@app/utils/cn.ts";
// Based on Nuxt UI `UPage` component. Responsive docs grid with optional `#left` (sidebar) and
// `#right` (TOC aside) slots plus the default (main content) slot.
//
// The grid is FIXED side tracks (`--ui-aside` / `--ui-toc`, `main.css`) around a
// `minmax(0,1fr)` content column, and it turns on at two different widths:
//   - left  → from `md` (the shared shell threshold — see `SiteHeader`; below it
//             the sidebar hides and the mobile drawer takes over, so `PageAside`
//             and the header must move together)
//   - right → from `lg` only: the ToC is the first thing a narrower desktop
//             gives up, and `DocsToc` hides itself at the same width
//   - main  → whatever is left, and it is the ONLY track that flexes
//
// It was 2 of 10 proportional columns per side until the shell dropped to `md`;
// see `--ui-aside` for why a fraction could not follow it down.
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
  <div
    :class="
      cn(
        $slots.left && 'md:grid md:grid-cols-[var(--ui-aside)_minmax(0,1fr)] md:gap-8',
        $slots.right && 'lg:grid lg:gap-8',
        $slots.right &&
          ($slots.left
            ? 'lg:grid-cols-[var(--ui-aside)_minmax(0,1fr)_var(--ui-toc)]'
            : 'lg:grid-cols-[minmax(0,1fr)_var(--ui-toc)]'),
      )
    "
  >
    <aside v-if="$slots.left" :class="props.ui?.left">
      <slot name="left" />
    </aside>

    <div class="min-w-0 py-2">
      <slot />
    </div>

    <div v-if="$slots.right">
      <slot name="right" />
    </div>
  </div>
</template>
