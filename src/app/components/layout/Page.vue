<script setup lang="ts">
import { cn } from "@app/utils/cn.ts";
// Based on Nuxt UI's `UPage`. Keep left/sidebar at `md` with the shell and the
// right/ToC track at `lg`. Read `$slots` during render because it is not reactive.
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
