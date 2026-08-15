<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@app/utils/cn.ts";
/**
 * Kbd — Geist's `data-geist-kbd` chip, for keyboard hints (⌘K, Esc).
 *
 * Geist draws it as a 20px pill on the PAGE surface (`--background`) with a
 * hairline ring rather than a border, so the chip keeps its 20px box whatever it
 * sits inside — a border would add 2px to a control that is often nested in
 * another 32px one. `ring-1 ring-border` is that hairline: `--border` is Geist's
 * gray-alpha 400, the exact shadow colour it ships.
 *
 * `min-w-5` + `min-w-[1em]` per key is Geist's too: a glyph key (⌘, ⇧, ↵) is
 * narrower than a letter, so without a floor the chip visibly shrinks around
 * it and a `⌘K` reads as two different-sized boxes.
 *
 * Keys come either from `keys` (rendered as per-key spans) or the default slot
 * (free text such as `Esc`).
 */
const props = defineProps<{
  keys?: string[];
  class?: unknown;
}>();

const keyList = computed(() => props.keys ?? []);
</script>

<template>
  <kbd
    :class="
      cn(
        'inline-flex h-5 min-w-5 shrink-0 items-center justify-center gap-px rounded-sm bg-background px-1',
        'font-sans text-label-12 font-medium text-muted-foreground ring-1 ring-border',
        props.class,
      )
    "
  >
    <span v-for="(key, i) in keyList" :key="i" class="inline-block min-w-[1em] text-center">
      {{ key }}
    </span>
    <slot />
  </kbd>
</template>
