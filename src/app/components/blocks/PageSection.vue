<script setup lang="ts">
/**
 * A landing/docs section: an optional header, then a body.
 *
 * The header lives OUTSIDE the frame — above the `framed` box, above the
 * features grid — sitting on the page background rather than inside a cell.
 * That is what the whole design follows from: a heading that has to survive
 * next to a rule line can't also be the loudest thing on the page, so it is a
 * plain left-aligned Geist `heading-24` with a muted line under it, aligned to
 * the frame's left edge (both sit inside the same `Container`, so their left
 * edges are the same x). The old centered, gradient-clipped display heading
 * fought the box for attention and re-centered every section against a
 * left-aligned page.
 *
 * Everything else is spacing: Geist sections breathe with padding, not with
 * type size, so the rhythm is `py-12/16` with a `mt-6` gap to the body.
 */
import { computed, useSlots } from "vue";
import { cn } from "@app/utils/cn.ts";
import Container from "@app/components/Container.vue";
import Grid from "@app/components/grid/Grid.vue";
import GridCell from "@app/components/grid/GridCell.vue";
import GridCross from "@app/components/grid/GridCross.vue";
import GridSystem from "@app/components/grid/GridSystem.vue";
const props = defineProps<{
  id?: string;
  title?: string;
  // Screen-reader-only heading. Used when a section has no VISIBLE `title` but
  // still needs an `<h2>` so the page's heading levels don't skip (e.g. the
  // landing's features sit between the hero `<h1>` and the feature `<h3>`s).
  srTitle?: string;
  description?: string;
  // Frame the body in a Geist single-cell grid: rules on all four sides with a
  // cross on each corner (vercel.com/geist/grid). For sections whose
  // content is a data-driven cloud — sponsors, contributors — where the item
  // count is unknown, so a real cell-and-guide grid has no row count to draw.
  framed?: boolean;
  ui?: {
    container?: string;
    header?: string;
    title?: string;
    description?: string;
    body?: string;
    [key: string]: string | undefined;
  };
}>();

const slots = useSlots();

// The body's top margin exists only to clear a header — `srTitle` alone doesn't
// count, it renders nothing.
const hasHeader = computed(() => Boolean(props.title || props.description || slots.actions));
</script>

<template>
  <!-- `isolate` went with the section aura: it existed so that backdrop's
       `z-index: -10` resolved here instead of at the app shell. Nothing inside a
       section paints below its own content now. -->
  <section :id="id" class="relative scroll-mt-20">
    <Container :class="cn('py-12 sm:py-16', ui?.container)">
      <!-- Accessible-only heading (keeps heading levels from skipping) -->
      <h2 v-if="!title && srTitle" class="sr-only">{{ srTitle }}</h2>

      <!-- Header. Outside the frame, left-aligned to it. `items-end` so a
           trailing action sits on the heading's baseline side rather than
           floating above a two-line description. -->
      <div
        v-if="hasHeader"
        :class="
          cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-8', ui?.header)
        "
      >
        <div class="min-w-0">
          <h2 v-if="title" :class="cn('text-heading-24 text-foreground text-balance', ui?.title)">
            {{ title }}
          </h2>
          <p
            v-if="description"
            :class="
              cn('mt-2 max-w-2xl text-copy-16 text-muted-foreground text-pretty', ui?.description)
            "
          >
            {{ description }}
          </p>
        </div>

        <!-- Section-level action (e.g. "Become a Sponsor"), kept out of the
             frame with the rest of the header. -->
        <div v-if="slots.actions" class="shrink-0">
          <slot name="actions" />
        </div>
      </div>

      <div :class="cn(hasHeader ? 'mt-6' : '', ui?.body)">
        <!-- Features grid -->
        <ul
          v-if="slots.features"
          class="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0"
        >
          <slot name="features" />
        </ul>

        <!-- Framed: one cell with a cross on each of the four line
             intersections. Solid, to match the shell's own rules — Geist's
             dashed guides are a variant of the Grid component's page demo, not
             something its docs chrome mixes in. -->
        <GridSystem v-if="framed">
          <Grid :columns="1" :rows="1">
            <GridCross :column="1" :row="1" />
            <GridCross :column="2" :row="1" />
            <GridCross :column="1" :row="2" />
            <GridCross :column="2" :row="2" />
            <GridCell>
              <slot />
            </GridCell>
          </Grid>
        </GridSystem>
        <slot v-else />
      </div>
    </Container>
  </section>
</template>
