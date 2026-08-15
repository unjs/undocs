<script setup lang="ts">
import { cn } from "@app/utils/cn.ts";
/**
 * Separator — the `USeparator` replacement.
 *
 * `type="dashed"` swaps the filled 1px line for a dashed border (the line is a
 * plain `<div>`, so "dashed" can't be a background color). When a `label` prop
 * or default slot is given, renders two separator segments flanking centered
 * content (used e.g. for a logo divider in `AppFooter`).
 *
 * The line itself was reka-ui's `<Separator>` (MIT,
 * https://github.com/unovue/reka-ui) and is now the local `lineAttrs` below.
 * That primitive is pure markup — no state, no events — so the port is just its
 * ARIA contract, copied from reka's `BaseSeparator`: `role="separator"`, a
 * `data-orientation` attribute in both orientations (our `lineClass` doesn't
 * key off it, but a consumer's `data-[orientation=…]:` selector could), and
 * `aria-orientation` ONLY when vertical — horizontal is the ARIA default and
 * emitting it is redundant.
 *
 * Two reka features are deliberately not carried over: `decorative` (it swaps
 * `role="separator"` for `role="none"`; no caller of ours passes it, and every
 * separator we draw is a real content division) and the runtime orientation
 * guard (reka accepts arbitrary strings from JS callers and coerces invalid
 * ones to horizontal — our prop is a typed union with a default, so there is
 * nothing to coerce).
 */
import { computed, useSlots } from "vue";

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

const lineAttrs = computed(() => ({
  role: "separator",
  "data-orientation": props.orientation,
  "aria-orientation": props.orientation === "vertical" ? props.orientation : undefined,
}));

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
    <div v-bind="lineAttrs" :class="cn(lineClass, 'flex-1')" />
    <span class="shrink-0 text-xs text-muted-foreground">
      <slot>{{ label }}</slot>
    </span>
    <div v-bind="lineAttrs" :class="cn(lineClass, 'flex-1')" />
  </div>
  <div v-else v-bind="lineAttrs" :class="cn(lineClass, props.class)" />
</template>
