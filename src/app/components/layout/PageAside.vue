<script setup lang="ts">
// Based on Nuxt UI `UPageAside` component. Sticky left sidebar container with its own scroll,
// offset below the 4rem sticky header — plus the 3rem section-tabs bar when it
// is on screen. Hidden below `lg`, where the mobile slideover
// (`SiteHeader` `#body`) takes over.
import { cn } from "@app/utils/cn";
import { useSectionTabs } from "@app/composables/useSectionTabs";
const { visible: hasSubnav } = useSectionTabs();
</script>

<template>
  <div
    :class="
      cn(
        'hidden lg:block sticky overflow-y-auto py-8 pr-4',
        hasSubnav
          ? 'top-[calc(7rem+var(--status-banner-height))] max-h-[calc(100vh-7rem-var(--status-banner-height))]'
          : 'top-[calc(4rem+var(--status-banner-height))] max-h-[calc(100vh-4rem-var(--status-banner-height))]',
      )
    "
  >
    <slot />
  </div>
</template>
