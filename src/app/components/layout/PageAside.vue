<script setup lang="ts">
// Based on Nuxt UI `UPageAside` component. Sticky left sidebar container with its own scroll,
// offset below the 4rem sticky header — plus the 3rem section-tabs bar when it
// is on screen. Hidden below `lg` (the shared desktop threshold — see
// `SiteHeader`), where the mobile slideover (`SiteHeader` `#body`) takes over.
import { cn } from "@app/utils/cn.ts";
import { useSectionTabs } from "@app/composables/useSectionTabs.ts";
const { visible: hasSubnav } = useSectionTabs();
</script>

<template>
  <div
    :class="
      cn(
        // `-ml-2 pl-2` cancel out, so the content sits exactly where it did —
        // but the 8px are load-bearing: `overflow-y-auto` clips at the PADDING
        // box, and the nav rows deliberately bleed 8px each way (`-mx-2` in
        // `DocsNavigation`), so without left padding the leftmost 8px of every
        // hover/active fill is sliced off square. `pr-4` already covers the
        // right bleed.
        'hidden lg:block sticky overflow-y-auto py-8 -ml-2 pl-2 pr-4',
        hasSubnav
          ? 'top-[calc(7rem+var(--status-banner-height))] max-h-[calc(100vh-7rem-var(--status-banner-height))]'
          : 'top-[calc(4rem+var(--status-banner-height))] max-h-[calc(100vh-4rem-var(--status-banner-height))]',
      )
    "
  >
    <slot />
  </div>
</template>
