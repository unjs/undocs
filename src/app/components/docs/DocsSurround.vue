<script setup lang="ts">
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink";
// Based on Nuxt UI `UContentSurround` component. Prev/next navigation cards from the
// `[prev, next]` surround tuple (either entry may be null). A passed `class`
// falls through onto the root grid.
import type { SurroundItem } from "../../server/content/types";

defineProps<{
  surround: Array<SurroundItem | null>;
}>();
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <AppLink
      v-if="surround[0]"
      :to="surround[0].path"
      class="group flex flex-col gap-1 rounded-lg border border-border p-4 transition-colors hover:border-primary hover:bg-muted/50"
    >
      <span class="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon name="i-lucide-chevron-left" class="size-3.5" />
        Previous
      </span>
      <span class="font-medium text-foreground group-hover:text-primary">
        {{ surround[0].title }}
      </span>
    </AppLink>
    <span v-else aria-hidden="true" />

    <AppLink
      v-if="surround[1]"
      :to="surround[1].path"
      class="group flex flex-col items-end gap-1 rounded-lg border border-border p-4 text-right transition-colors hover:border-primary hover:bg-muted/50"
    >
      <span class="flex items-center gap-1 text-xs text-muted-foreground">
        Next
        <Icon name="i-lucide-chevron-right" class="size-3.5" />
      </span>
      <span class="font-medium text-foreground group-hover:text-primary">
        {{ surround[1].title }}
      </span>
    </AppLink>
    <span v-else aria-hidden="true" />
  </div>
</template>
