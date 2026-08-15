<script setup lang="ts">
 /**
 * The page shell — FULL-BLEED.
 *
 * It wraps the header, main and footer, but it constrains nothing horizontally:
 * the shell is as wide as the viewport, and each piece of chrome inside it caps
 * its own CONTENT at `--ui-container` through `Container`. So the layout still
 * reads as a centred column, while every horizontal rule the chrome draws — the
 * section-tabs bar's `border-y`, the footer's `border-t`, the header's own
 * border — runs edge to edge instead of stopping partway across the screen.
 *
 * This used to be Geist's boxed shell (a centred `max-w-[1220px]` carrying its
 * own left/right rails, as on vercel.com/geist/introduction), which is why the
 * chrome is arranged the way it is: everything with a rule of its own lives in
 * here so the rules share one set of edges. That is still true — the edges are
 * now the viewport's rather than the box's, and the vertical rails are gone.
 *
 * The wrapper itself stays, and is NOT a leftover. It is the containing block
 * for the landing's `FilmBackground` — hence `position: relative`. It is the
 * only element that spans header, main AND footer, so a backdrop parented here
 * runs the full height of the page (up behind the sticky header, down through
 * the sections) in one piece. Anchoring it to `<main>` instead cut it off at
 * both ends. Deliberately not `isolate`: the app shell keeps the stacking
 * context, which is what lets the backdrop's `z-index: -10` land behind content
 * yet in front of the `html`/`body` background.
 */
</script>

<template>
  <div class="ug-page">
    <slot />
  </div>
</template>

<style scoped>
.ug-page {
  position: relative;
  width: 100%;
}
</style>
