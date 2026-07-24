<script setup lang="ts">
import { cn } from "@app/utils/cn";
/**
 * Skeleton — the `USkeleton` replacement. Class-only pulsing placeholder
 * block; every visual (size, shape) comes from the caller's `class`.
 */
const props = defineProps<{
  class?: unknown;
}>();
</script>

<template>
  <div :class="cn('animate-pulse rounded-md bg-muted', props.class)" />
</template>
