<script setup lang="ts">
import { cn } from "@app/utils/cn.ts";
const props = defineProps<{
  class?: unknown;
}>();
</script>

<template>
  <div :class="cn('animate-pulse rounded-md bg-muted', props.class)" />
</template>
