<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@app/utils/cn.ts";
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
