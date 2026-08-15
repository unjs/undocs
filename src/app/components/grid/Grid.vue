<script setup lang="ts">
/**
 * Geist `Grid` — a coordinate system of columns and rows whose RULE LINES are
 * part of the design (vercel.com/geist/grid). Guides render only inside a
 * `GridSystem`; on its own this is a plain CSS grid.
 *
 * Use it for marketing pages, docs landing pages, and feature breakdowns where
 * the lines and cell borders are the visual language. For ordinary responsive
 * content with no visible guides, a Tailwind `grid grid-cols-*` is the right
 * tool — this component buys you nothing there and costs a guide layer.
 *
 * Don't nest one `Grid` inside another more than a single level: overlapping
 * guide layers read as noise, and the inner grid's tracks no longer relate to
 * the outer one's.
 *
 * ## How the guides are drawn
 *
 * The obvious implementation — a repeating gradient, or lines positioned at
 * `calc(i * 100% / cols)` — puts each line at a rounded percentage while the
 * real grid tracks round independently, so guides drift off the cell edges by
 * a pixel at most column counts. Instead the guide layer is ITSELF a grid with
 * the same template, and each line is a grid item that borders one track edge.
 * Track rounding then applies to the guides and the cells identically, and they
 * cannot disagree.
 *
 * The cost is that the NUMBER of line elements changes with the column count,
 * which is responsive — and no amount of CSS can add DOM nodes at a
 * breakpoint. So we emit one guide layer per distinct `(columns, rows)` shape
 * and let media queries swap which layer is displayed. Adjacent breakpoints
 * that resolve to the same shape share a layer, so the common case
 * (`columns` responsive, `rows` responsive, three distinct shapes) costs three
 * layers of `(cols - 1) + (rows - 1)` spans, and a non-responsive grid costs
 * one.
 *
 * The outer frame is the grid's OWN border, not part of the layer: an
 * absolutely positioned child resolves `inset: 0` against the padding box,
 * which is also where the tracks live, so the layer and the cells share one
 * coordinate space only as long as the border stays on the container.
 */
import { computed, inject } from "vue";
import { GRID_SYSTEM_KEY } from "./context.ts";
import {
  guideLayers as buildGuideLayers,
  resolveResponsive,
  responsiveVars,
  type Resolved,
  type Responsive,
} from "./responsive.ts";

const props = withDefaults(
  defineProps<{
    columns?: Responsive<number>;
    rows?: Responsive<number>;
    /** Square cells: the grid takes the height its column/row ratio implies. */
    height?: "preserve-aspect-ratio";
    /**
     * Drop one axis of guides. Hiding BOTH means the guides aren't part of the
     * design, which is the signal to use a plain Tailwind grid instead.
     */
    hideGuides?: "row" | "column";
    /** Element to render as — `ul` when the cells are list items. */
    as?: string;
  }>(),
  { as: "div" },
);

const system = inject(GRID_SYSTEM_KEY, undefined);

// A grid needs at least one track on each axis; a `0` would make `repeat()`
// invalid and collapse the whole template.
const columns = computed(() => clamp(resolveResponsive(props.columns, 1)));
const rows = computed(() => clamp(resolveResponsive(props.rows, 1)));

function clamp(resolved: Resolved<number>): Resolved<number> {
  return {
    sm: Math.max(1, Math.trunc(resolved.sm)),
    md: Math.max(1, Math.trunc(resolved.md)),
    lg: Math.max(1, Math.trunc(resolved.lg)),
  };
}

const style = computed(() => ({
  ...responsiveVars("cols", columns.value),
  ...responsiveVars("rows", rows.value),
}));

// No `GridSystem` ancestor means no guides at all — a bare `Grid` is just a CSS
// grid, so the overlays never reach the DOM rather than being hidden in it.
const guideLayers = computed(() =>
  system ? buildGuideLayers(columns.value, rows.value, props.hideGuides) : [],
);
</script>

<template>
  <component
    :is="as"
    class="ug-grid"
    :class="[
      system && 'ug-grid--guided',
      hideGuides === 'row' && 'ug-grid--hide-row',
      hideGuides === 'column' && 'ug-grid--hide-column',
      height === 'preserve-aspect-ratio' && 'ug-grid--aspect',
    ]"
    :style="style"
  >
    <!-- Guides are decorative; the semantics live on the cell content. -->
    <div
      v-for="layer in guideLayers"
      :key="layer.key"
      class="ug-guides"
      :class="layer.classes"
      aria-hidden="true"
    >
      <span
        v-for="i in layer.vLines"
        :key="`v${i}`"
        class="ug-guide ug-guide--v"
        :style="{ gridColumnStart: i + 1 }"
      />
      <span
        v-for="i in layer.hLines"
        :key="`h${i}`"
        class="ug-guide ug-guide--h"
        :style="{ gridRowStart: i + 1 }"
      />
    </div>
    <slot />
  </component>
</template>

<style scoped>
.ug-grid {
  /* Resolve the `GridSystem` overrides once, with the token as the fallback,
     so every guide rule below is a plain two-var reference. */
  --ug-gw: var(--ug-guide-width, var(--grid-guide-width));
  --ug-gs: var(--ug-guide-style, var(--grid-guide-style));

  --ug-cols: var(--ug-cols-sm);
  --ug-rows: var(--ug-rows-sm);

  /* Containing block for `GridCross`, and the reference box for the guide
     layer's `inset: 0`. */
  position: relative;
  /* Keep the guide/cell/cross z-indexes below LOCAL. Without a stacking context
     of its own, `position: relative; z-index: auto` would let a `solid` cell's
     `z-index: 1` compete with the rest of the page's layers instead of only
     with the guides it is meant to occlude. */
  isolation: isolate;
  display: grid;
  grid-template-columns: repeat(var(--ug-cols), minmax(0, 1fr));
  grid-template-rows: repeat(var(--ug-rows), minmax(0, 1fr));
}

@media (min-width: 48rem) {
  .ug-grid {
    --ug-cols: var(--ug-cols-md);
    --ug-rows: var(--ug-rows-md);
  }
}

@media (min-width: 64rem) {
  .ug-grid {
    --ug-cols: var(--ug-cols-lg);
    --ug-rows: var(--ug-rows-lg);
  }
}

.ug-grid--guided {
  border: var(--ug-gw) var(--ug-gs) var(--grid-guide);
}

/* Hiding an axis takes its frame edges with it — a `hideGuides="row"` grid that
   still drew a top and bottom rule would be showing two row guides. */
.ug-grid--hide-row {
  border-block: 0;
}

.ug-grid--hide-column {
  border-inline: 0;
}

/* `aspect-ratio` accepts the two counts directly, so square cells need no
   height measurement and no JS. */
.ug-grid--aspect {
  aspect-ratio: var(--ug-cols) / var(--ug-rows);
}

.ug-guides {
  position: absolute;
  inset: 0;
  /* Explicit `0` rather than `auto`: it keeps the layer in the same paint level
     as the cells, where DOM order decides, so a `solid` cell's background sits
     ON TOP of the guides behind it. With `auto` the positioned layer would
     paint above every non-positioned cell and rule lines would cut through
     text. */
  z-index: 0;
  display: none;
  grid-template-columns: repeat(var(--ug-cols), minmax(0, 1fr));
  grid-template-rows: repeat(var(--ug-rows), minmax(0, 1fr));
  pointer-events: none;
}

/* Each breakpoint hides the one below it and shows its own. A layer carrying
   several of these classes stays visible across that whole span. */
.ug-guides--sm {
  display: grid;
}

@media (min-width: 48rem) {
  .ug-guides--sm {
    display: none;
  }

  .ug-guides--md {
    display: grid;
  }
}

@media (min-width: 64rem) {
  .ug-guides--md {
    display: none;
  }

  .ug-guides--lg {
    display: grid;
  }
}

.ug-guide--v {
  grid-row: 1 / -1;
  border-left: var(--ug-gw) var(--ug-gs) var(--grid-guide);
}

.ug-guide--h {
  grid-column: 1 / -1;
  border-top: var(--ug-gw) var(--ug-gs) var(--grid-guide);
}
</style>
