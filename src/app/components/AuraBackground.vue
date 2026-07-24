<script setup lang="ts">
// Theme-aware backdrop aura, inspired by reka-ui's landing/docs backdrop
// (which is a baked green PNG). Reproduced here in CSS so it follows the
// configured theme color: every layer is tinted from `--ui-primary` via
// `color-mix`, so a project's primary drives the glow with no image asset.
//
// Mounted ONCE at the app shell (`app.vue`) inside a `relative isolate` wrapper
// that spans from the true top of the document — so the aura sits *behind* the
// sticky, translucent header (showing through its blur) instead of starting
// below the navbar. It's top-anchored with an explicit height and fades out
// downward (mask) so long content stays legible; it scrolls with the page.
//
// The `isolate` wrapper is what lets `z-index:-10` sit behind content yet above
// the `html`/`body` background (both paint `--background`) — a plain `fixed`
// negative-z layer would be painted *under* that background and vanish.
//
// - `hero`    — taller, richer glow for the landing (route `/`).
// - `docs`    — a faint top-right strip for every other page.
// - `section` — a soft centered glow filling a page section (sponsors,
//               contributors); fills its `relative` parent instead of anchoring
//               to the top.
//
// Purely decorative: `pointer-events-none` + `aria-hidden`.
withDefaults(defineProps<{ variant?: "hero" | "docs" | "section" }>(), { variant: "hero" });
</script>

<template>
  <div class="aura" :class="`aura--${variant}`" aria-hidden="true">
    <div class="aura__inner" />
  </div>
</template>

<style scoped>
.aura {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: -10;
  overflow: hidden;
  pointer-events: none;
}

.aura__inner {
  position: absolute;
  inset: 0;
  filter: blur(64px);
  /* Diagonal beam + two offset glows, all tinted from the theme primary. */
  background:
    radial-gradient(
      42% 16% at 62% 22%,
      color-mix(in oklab, var(--ui-primary) 60%, transparent),
      transparent 72%
    ),
    radial-gradient(
      34% 34% at 78% 30%,
      color-mix(in oklab, var(--ui-primary) 34%, transparent),
      transparent 70%
    ),
    radial-gradient(
      30% 30% at 42% 12%,
      color-mix(in oklab, var(--ui-primary) 26%, transparent),
      transparent 70%
    );
  background-repeat: no-repeat;
  /* Fade the whole aura out toward the bottom so it never washes content. */
  -webkit-mask-image: linear-gradient(to bottom, black 45%, transparent);
  mask-image: linear-gradient(to bottom, black 45%, transparent);
}

/* Hero: a tall, richer glow spanning the landing's first screenful. */
.aura--hero {
  height: 52rem;
}
/* Light mode needs a stronger tint — a translucent primary washes out against
   the near-white background, whereas on dark it reads as a glow. */
.aura--hero .aura__inner {
  opacity: 0.9;
}
.dark .aura--hero .aura__inner {
  opacity: 0.75;
}

/* Docs / other pages: a faint glow pushed to the top-right corner, well out of
   the way of the content column. */
.aura--docs {
  height: 40rem;
}
.aura--docs .aura__inner {
  opacity: 0.75;
  background:
    radial-gradient(
      38% 20% at 92% 12%,
      color-mix(in oklab, var(--ui-primary) 60%, transparent),
      transparent 72%
    ),
    radial-gradient(
      34% 34% at 104% 24%,
      color-mix(in oklab, var(--ui-primary) 34%, transparent),
      transparent 70%
    ),
    radial-gradient(
      26% 26% at 76% 6%,
      color-mix(in oklab, var(--ui-primary) 24%, transparent),
      transparent 70%
    );
  background-repeat: no-repeat;
}
.dark .aura--docs .aura__inner {
  opacity: 0.4;
}

/* Section: a soft centered glow filling its `relative isolate` parent. */
.aura--section {
  bottom: 0;
  height: auto;
}
.aura--section .aura__inner {
  opacity: 0.4;
  background: radial-gradient(
    60% 50% at 50% 45%,
    color-mix(in oklab, var(--ui-primary) 70%, transparent),
    transparent 78%
  );
  background-repeat: no-repeat;
  /* Symmetric radial fade already; no directional mask. */
  -webkit-mask-image: none;
  mask-image: none;
}
.dark .aura--section .aura__inner {
  opacity: 0.28;
}
</style>
