<script setup lang="ts">
import { cn } from "@app/utils/cn";
/**
 * Tooltip — the `UTooltip` replacement.
 *
 * Reka `TooltipRoot/Trigger/Content` (+ `Portal`). Must be mounted somewhere
 * under a `TooltipProvider` (see `AppProvider.vue`, which wraps the app root).
 * Default slot is the trigger.
 */
import { TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent } from "reka-ui";

const props = withDefaults(
  defineProps<{
    text?: string;
    kbds?: string[];
    delayDuration?: number;
    side?: "top" | "right" | "bottom" | "left";
    disabled?: boolean;
    class?: unknown;
  }>(),
  {
    delayDuration: 300,
    side: "top",
  },
);
</script>

<template>
  <TooltipRoot :delay-duration="delayDuration" :disabled="disabled">
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        :side="side"
        :side-offset="6"
        :class="
          cn(
            'z-50 flex items-center gap-1.5 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md',
            'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
            'data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1',
            props.class,
          )
        "
      >
        <slot name="text">{{ text }}</slot>
        <span v-if="kbds?.length" class="flex items-center gap-0.5">
          <kbd
            v-for="kbd in kbds"
            :key="kbd"
            class="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border/60 bg-muted px-1 font-mono text-[10px] uppercase text-muted-foreground"
          >
            {{ kbd }}
          </kbd>
        </span>
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
