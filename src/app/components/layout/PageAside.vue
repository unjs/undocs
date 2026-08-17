<script setup lang="ts">
// Based on Nuxt UI's `UPageAside`.
import { cn } from "@app/utils/cn.ts";
import { useSectionTabs } from "@app/composables/useSectionTabs.ts";
const { visible: hasSubnav } = useSectionTabs();
</script>

<template>
  <div
    :class="
      cn(
        // Padding prevents the scrollport clipping the nav rows' negative margin.
        'hidden md:block sticky overflow-y-auto py-8 -ml-2 pl-2 pr-4',
        hasSubnav
          ? 'top-[calc(7rem+var(--status-banner-height))] max-h-[calc(100vh-7rem-var(--status-banner-height))]'
          : 'top-[calc(4rem+var(--status-banner-height))] max-h-[calc(100vh-4rem-var(--status-banner-height))]',
      )
    "
  >
    <slot />
  </div>
</template>
