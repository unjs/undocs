<script setup lang="ts">
/**
 * AppProvider — the `UApp` replacement (custom, no single Reka primitive).
 *
 * All it does now is open one tooltip delay group for everything below it, so a
 * row of tooltips shares a warm window instead of each making you wait: see
 * `primitives/useTooltipGroup.ts`. It renders nothing.
 *
 * Ported from reka-ui's `TooltipProvider` (MIT,
 * https://github.com/unovue/reka-ui), which this replaced. reka's version was
 * also a render-nothing provider; the state it held — `isOpenDelayed` and the
 * skip-delay timer — is per-provider there and per-provider here, which is what
 * keeps it off the module scope AGENTS.md's per-request-state invariant rules
 * out.
 *
 * The `delayDuration` below is the group's FALLBACK, and as of today nothing
 * reaches it: `Tooltip`'s own `delayDuration` prop defaults to the same 300 and
 * therefore always wins, exactly as it did under reka (`props.delayDuration ??
 * providerContext.delayDuration`). It is passed anyway so the two numbers cannot
 * silently drift apart. `skipDelayDuration` is left at the ported default of
 * 300ms.
 *
 * Reka's `ConfigProvider` used to sit outside this, purely to declare
 * `dir="ltr"`. It was removed rather than ported: it renders nothing (it only
 * `provide()`s a context) and every consumer of that context injects it with a
 * fallback that is IDENTICAL to the defaults we were passing — `useDirection`
 * falls back to `ltr`, `useLocale` to `en`, `useBodyScrollLock` to
 * `scrollBody: true`, `useNonce` to undefined, and `useId` to Vue 3.5's own
 * SSR-stable `useId()`. So the provider was a no-op for us. The document's
 * direction is now stated where a non-Reka primitive can actually read it: the
 * `dir="ltr"` attribute on `<html>` in `entry-server.ts`.
 */
import { provideTooltipGroup } from "./primitives/useTooltipGroup.ts";

provideTooltipGroup({ delayDuration: 300 });
</script>

<template>
  <slot />
</template>
