<script setup lang="ts">
const props = defineProps<{ code: string }>()
const svg = useMermaid(() => props.code)
</script>

<template>
  <div v-if="svg" class="mermaid" v-html="svg"></div>
  <div v-else>
    <div class="grid gap-2">
      <USkeleton class="h-4 w-[250px]" />
      <USkeleton class="h-4 w-[200px]" />
      <USkeleton class="h-4 w-[200px]" />
    </div>
  </div>
</template>
