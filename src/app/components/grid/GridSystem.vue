<script setup lang="ts">
/**
 * Geist `GridSystem` — the wrapper that turns guides on for the `Grid`s inside
 * it (vercel.com/geist/grid).
 *
 * It carries the two guide knobs (`guideWidth`, `dashedGuides`) as inherited
 * custom properties so a scoped stylesheet three components down can read them,
 * and provides its presence so `Grid` knows whether to emit guide markup at all.
 *
 * `container` is our name for Geist's `unstable_useContainer`: constrain the
 * system to the site's content column. It reuses `Container.vue`'s own
 * max-width and padding rather than restating them, so the grid's outer guides
 * land exactly on the edge every other block on the page aligns to.
 */
import { computed, provide } from "vue";
import { GRID_SYSTEM_KEY } from "./context.ts";

const props = withDefaults(
  defineProps<{
    /** Guide thickness in px. Defaults to the `--grid-guide-width` token (1px). */
    guideWidth?: number;
    /** Draw guides dashed instead of solid — Geist's full-bleed page look. */
    dashedGuides?: boolean;
    /** Constrain to the site content column (Geist's `unstable_useContainer`). */
    container?: boolean;
    /** Tint cells and guides so an empty grid is visible while authoring. */
    debug?: boolean;
  }>(),
  { dashedGuides: false, container: false, debug: false },
);

provide(GRID_SYSTEM_KEY, { enabled: true });

// `undefined` entries are omitted by Vue's style binding, which is what lets
// the token defaults in `tokens.css` show through when a prop isn't set.
const style = computed(() => ({
  "--ug-guide-width": props.guideWidth === undefined ? undefined : `${props.guideWidth}px`,
  "--ug-guide-style": props.dashedGuides ? "dashed" : undefined,
}));
</script>

<template>
  <div
    class="ug-system"
    :class="[
      container && 'mx-auto w-full max-w-[var(--ui-container)] px-4 sm:px-6 lg:px-8',
      debug && 'ug-system--debug',
    ]"
    :style="style"
  >
    <slot />
  </div>
</template>

<style scoped>
/*
 * Debug mode makes the structure legible while authoring: guides jump to the
 * brand colour and every cell gets a wash, so an empty grid (Geist's `Grid`
 * with no `GridCell` children) is still visible.
 *
 * `--brand` rather than `--brand`: these are hairlines and an 8% wash with
 * nothing read against them, so the accent's WCAG derivation would spend chroma
 * on a guarantee nobody collects — and a washed-out debug guide defeats the one
 * thing debug mode is for.
 */
.ug-system--debug {
  --grid-guide: var(--brand);
  --grid-cross: var(--brand);
}

.ug-system--debug :deep(.ug-cell) {
  background-color: color-mix(in oklab, var(--brand) 8%, transparent);
}
</style>
