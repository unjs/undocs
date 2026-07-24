<script setup lang="ts">
import { useDocsSearch } from "@app/composables/useDocsSearch";
import Icon from "@app/components/global/Icon.vue";
const { toggle } = useDocsSearch();
</script>

<template>
  <button
    type="button"
    aria-label="Search documentation"
    class="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    @click="toggle"
  >
    <Icon name="i-lucide-search" class="size-5 shrink-0 sm:size-4" />
    <span class="hidden w-20 text-left sm:inline-block lg:w-28">Search</span>
    <kbd
      class="ml-auto hidden shrink-0 items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium sm:inline-flex"
    >
      <span class="text-xs">⌘</span>K
    </kbd>
  </button>
</template>
