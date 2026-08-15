<script setup lang="ts">
/**
 * Geist `GridCell` — one cell of a `Grid` (vercel.com/geist/grid).
 *
 * `column`/`row` take Geist's span notation (`"1/3"`, `"1/-1"`) or a bare line
 * number, either as one value or per breakpoint. Omit both and the cell
 * auto-places, which is what you want when the cells simply fill the grid in
 * order.
 *
 * `solid` marks a cell as OPAQUE so the guides behind it stop showing through.
 * A cell that spans several tracks has interior guides crossing it; without
 * `solid` those lines run straight through its content. Cells that occupy a
 * single track need no `solid` — there is nothing behind them to occlude, and
 * setting it would paint over the very guides that frame the cell.
 */
import { computed } from "vue";
import { gridLine, resolveResponsive, responsiveVars, type Responsive } from "./responsive.ts";

const props = withDefaults(
  defineProps<{
    column?: Responsive<string | number>;
    row?: Responsive<string | number>;
    /** Occlude the guides behind this cell (for spanning, opaque content). */
    solid?: boolean;
    /** Element to render as — `li` inside a `Grid as="ul"`. */
    as?: string;
  }>(),
  { as: "div", solid: false },
);

const style = computed(() => ({
  ...responsiveVars("cell-col", resolveResponsive(props.column, "auto"), gridLine),
  ...responsiveVars("cell-row", resolveResponsive(props.row, "auto"), gridLine),
}));
</script>

<template>
  <component :is="as" class="ug-cell" :class="solid && 'ug-cell--solid'" :style="style">
    <slot />
  </component>
</template>

<style scoped>
.ug-cell {
  position: relative;
  /* Same paint level as the guide layer, later in DOM order — see `Grid.vue`. */
  z-index: 0;
  /* Grid items default to `min-width: auto`, which lets a long unbroken string
     (a code span, a URL) push a track past its 1fr share and knock every guide
     out of alignment. */
  min-width: 0;
  padding: var(--grid-cell-padding);

  /* Base (Geist `sm`) placement. Every rule here carries the same specificity,
     so the two media queries below override it purely on source order — they
     must stay after this block. */
  grid-column: var(--ug-cell-col-sm);
  grid-row: var(--ug-cell-row-sm);
}

@media (min-width: 48rem) {
  .ug-cell {
    grid-column: var(--ug-cell-col-md);
    grid-row: var(--ug-cell-row-md);
  }
}

@media (min-width: 64rem) {
  .ug-cell {
    grid-column: var(--ug-cell-col-lg);
    grid-row: var(--ug-cell-row-lg);
  }
}

.ug-cell--solid {
  z-index: 1;
  background-color: var(--background);
}
</style>
