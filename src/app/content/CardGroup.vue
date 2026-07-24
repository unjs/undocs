<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@app/utils/cn";

/**
 * `::card-group` — a responsive grid wrapper for `::card`s. `cols` sets the
 * column count at the `sm:` breakpoint and up (default 2); it stacks to a
 * single column on narrow screens.
 */
const props = defineProps<{
  cols?: number | string;
  [key: string]: unknown;
}>();

const COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

const colsClass = computed(() => COLS[Number(props.cols) || 2] || COLS[2]);
</script>

<template>
  <div :class="cn('not-prose grid gap-4 my-6', colsClass)">
    <slot />
  </div>
</template>
