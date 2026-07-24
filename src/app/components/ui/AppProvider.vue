<script setup lang="ts">
/**
 * AppProvider — the `UApp` replacement (custom, no single Reka primitive).
 *
 * Wraps the app root with Reka's `ConfigProvider` (global dir/locale for all
 * primitives) and `TooltipProvider` (required ancestor for every `Tooltip`).
 * Kept minimal — no theme/portal-target logic beyond what Reka needs.
 */
import { ConfigProvider, TooltipProvider } from "reka-ui";
</script>

<template>
  <ConfigProvider dir="ltr">
    <TooltipProvider :delay-duration="300">
      <slot />
    </TooltipProvider>
  </ConfigProvider>
</template>
