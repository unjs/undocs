<script setup lang="ts">
import { cn } from "@app/utils/cn";
/**
 * ButtonGroup — the `UFieldGroup` replacement (custom, no Reka primitive).
 *
 * Wraps its children (typically a `Button` + a `DropdownMenu` whose trigger
 * is a `Button`) with joined borders/radius: only the first/last rendered
 * child keep rounded corners, and each subsequent child's left border
 * collapses onto the previous one's. Works on direct DOM children — a
 * `DropdownMenu`'s trigger `Button` renders `as-child` (no wrapper element),
 * so it still lands as a direct child here.
 *
 * `size` is accepted for API parity with `UFieldGroup`; call sites already
 * pass `size` down to each child directly (`Button`/`DropdownMenu`), so it's
 * exposed via `provide` for any descendant that wants to read it, but nothing
 * currently requires it.
 */
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
        // Join children: collapse borders, square inner corners, keep the
        // hovered/focused edge on top so its border isn't hidden underneath.
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
