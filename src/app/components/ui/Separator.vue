<script setup lang="ts">
import { cn } from "@app/utils/cn";
/**
 * Separator — the `USeparator` replacement.
 *
 * Reka `Separator`. `type="dashed"` swaps the filled 1px line for a dashed
 * border (Reka's own primitive renders a plain `<div>`, so "dashed" can't be a
 * background color). When a `label` prop or default slot is given, renders two
 * separator segments flanking centered content (used e.g. for a logo divider
 * in `AppFooter`).
 */
import { computed, useSlots } from "vue";
// Imported under an aliased name so the tag never resolves back to this SFC
// (whose own inferred name is `Separator`) — avoids an infinite-recursion footgun.
import { Separator as SeparatorRoot } from "reka-ui";

const props = withDefaults(
  defineProps<{
    orientation?: "horizontal" | "vertical";
    type?: "solid" | "dashed";
    label?: string;
    class?: unknown;
  }>(),
  {
    orientation: "horizontal",
    type: "solid",
  },
);

const slots = useSlots();
const hasContent = computed(() => Boolean(props.label) || Boolean(slots.default));

const lineClass = computed(() =>
  cn(
    "shrink-0 bg-border",
    props.orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
    props.type === "dashed" &&
      (props.orientation === "horizontal"
        ? "h-0 border-t border-dashed border-border bg-transparent"
        : "w-0 border-l border-dashed border-border bg-transparent"),
  ),
);
</script>

<template>
  <div
    v-if="hasContent"
    :class="
      cn(
        'flex items-center gap-3',
        orientation === 'vertical' ? 'flex-col' : 'flex-row',
        props.class,
      )
    "
  >
    <SeparatorRoot :orientation="orientation" :class="cn(lineClass, 'flex-1')" />
    <span class="shrink-0 text-xs text-muted-foreground">
      <slot>{{ label }}</slot>
    </span>
    <SeparatorRoot :orientation="orientation" :class="cn(lineClass, 'flex-1')" />
  </div>
  <SeparatorRoot v-else :orientation="orientation" :class="cn(lineClass, props.class)" />
</template>
