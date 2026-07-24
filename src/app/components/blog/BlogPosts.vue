<script setup lang="ts">
import { cn } from "@app/utils/cn";
defineProps<{
  class?: unknown;
}>();
</script>

<template>
  <div :class="cn('grid grid-cols-1 gap-6 sm:gap-8', $props.class)">
    <slot />
  </div>
</template>
