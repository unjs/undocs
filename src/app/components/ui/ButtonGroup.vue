<script setup lang="ts">
import { cn } from "@app/utils/cn.ts";
import { provide } from "vue";

const props = withDefaults(
  defineProps<{
    size?: "xs" | "sm" | "md" | "lg";
    orientation?: "horizontal" | "vertical";
    class?: unknown;
  }>(),
  {
    orientation: "horizontal",
  },
);

provide("buttonGroupSize", props.size);
</script>

<template>
  <div
    :class="
      cn(
        'inline-flex',
        orientation === 'vertical' ? 'flex-col' : 'flex-row',
        orientation === 'vertical'
          ? '[&>*:not(:first-child)]:-mt-px [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none'
          : '[&>*:not(:first-child)]:-ml-px [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none',
        '[&>*]:relative [&>*:hover]:z-10 [&>*:focus-visible]:z-10',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
