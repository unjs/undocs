<script setup lang="ts">
/**
 * Geist `GridCross` — a `+` marker on one intersection of a `Grid`'s guide
 * lines (vercel.com/geist/grid).
 *
 * Coordinates are grid LINES, not cells, so they run 1..n+1: the four corners
 * of a 3x2 grid are (1,1), (4,1), (1,3) and (4,3). Both take Geist's
 * per-breakpoint form, which matters because the corner of a responsive grid
 * moves with the column count.
 *
 * Unlike the guide lines, a cross is positioned by percentage rather than by
 * grid placement. Placing it on a grid line would mean giving it a start with
 * no end, and an item at line `n+1` would then span into an implicit track and
 * change the very grid it is marking. Percentage rounding can leave it a
 * fraction of a pixel off the rule it sits on, which is invisible on a 9px
 * marker centred over the crossing.
 */
import { computed } from "vue";
import { resolveResponsive, responsiveVars, type Responsive } from "./responsive.ts";

const props = defineProps<{
  /** Vertical guide line to sit on, 1..columns+1. */
  column?: Responsive<number>;
  /** Horizontal guide line to sit on, 1..rows+1. */
  row?: Responsive<number>;
}>();

const style = computed(() => ({
  ...responsiveVars("cross-col", resolveResponsive(props.column, 1)),
  ...responsiveVars("cross-row", resolveResponsive(props.row, 1)),
}));
</script>

<template>
  <span class="ug-cross" :style="style" aria-hidden="true" />
</template>

<style scoped>
.ug-cross {
  --ug-cross-col: var(--ug-cross-col-sm);
  --ug-cross-row: var(--ug-cross-row-sm);

  position: absolute;
  /* Above the cells, so a `solid` cell meeting a corner doesn't swallow it. */
  z-index: 2;
  width: var(--grid-cross-size);
  height: var(--grid-cross-size);
  /* `--ug-cols` / `--ug-rows` are inherited from the enclosing `Grid`, and are
     already the resolved-for-this-breakpoint counts. */
  left: calc((var(--ug-cross-col) - 1) * 100% / var(--ug-cols));
  top: calc((var(--ug-cross-row) - 1) * 100% / var(--ug-rows));
  translate: -50% -50%;
  pointer-events: none;
}

@media (min-width: 48rem) {
  .ug-cross {
    --ug-cross-col: var(--ug-cross-col-md);
    --ug-cross-row: var(--ug-cross-row-md);
  }
}

@media (min-width: 64rem) {
  .ug-cross {
    --ug-cross-col: var(--ug-cross-col-lg);
    --ug-cross-row: var(--ug-cross-row-lg);
  }
}

/* The two arms. `--grid-cross` is a step above `--grid-guide` so the marker
   reads as a deliberate annotation rather than a thicker piece of rule. */
.ug-cross::before,
.ug-cross::after {
  content: "";
  position: absolute;
  background-color: var(--grid-cross);
}

.ug-cross::before {
  left: 0;
  right: 0;
  top: 50%;
  height: var(--grid-guide-width);
  translate: 0 -50%;
}

.ug-cross::after {
  top: 0;
  bottom: 0;
  left: 50%;
  width: var(--grid-guide-width);
  translate: -50% 0;
}
</style>
