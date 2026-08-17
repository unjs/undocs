<script setup lang="ts">
// Monochrome film backdrop for the landing — grain over a soft tonal wash,
// replacing the coloured aura this used to be. Geist is monochrome (see
// `assets/tokens.css`), so a themed glow was the one place the page reached for
// `--brand` as a large surface; every layer here is mixed from `--foreground`
// instead, at single-digit alpha.
//
// Because `--foreground` is declared per mode, it flips on its own inside
// `.dark`: the wash reads as photographic tone on white and as a soft bloom on
// black, and the grain is ink specks in light / silver specks in dark. Only the
// two opacities differ per mode — grain needs a touch more weight on a 4% page.
//
// Mounted ONCE, for the landing only, as the first child of `GridPage`
// (`app.vue`) — the page shell, which is `relative` for exactly this. So it
// spans the WHOLE page vertically: up behind the sticky header (transparent at
// rest, so the glow reads through it; blurred once scrolled) and down through
// every section to the footer. The shell is full-bleed, so the film is too: it
// has no side edge, which is the right answer for a backdrop — the light is
// centred on the page and simply runs out before the viewport does.
//
// That vertical span is why the wash is sized in REMS, not percentages. A
// percentage radius resolves against this element, which is now as tall as the
// document: the same gradient would be a tidy hero glow on a short page and a
// full-page smear on a long one, and the falloff would land wherever the last
// section happens to end. Absolute lengths keep one physical light source
// anchored near the top whatever the page below it does.
//
// Nothing is masked or cut. The wash ends by reaching `transparent` and the
// grain simply covers the box, because any hard stop — an element height, a
// fade — announces itself as a horizontal seam across the page.
//
// It is the LANDING's backdrop and nothing else's. The aura it replaced also lit
// the sponsors/contributors sections from `PageSection`'s `aura` prop; those are
// plain now. One light source per page is the Geist reading.
//
// `GridPage` deliberately does NOT `isolate`. The app shell's `relative isolate`
// wrapper stays the stacking context, which is what lets `z-index: -10` sit
// behind content yet above the `html`/`body` background (both paint
// `--background`).
//
// Four things are deliberate:
//
// 1. The grain is a MASK, not an image or a blend mode. `mix-blend-mode` would
//    blend against the isolated stacking context's backdrop — which is empty,
//    since this is its bottom-most layer — so it would do nothing useful. A
//    noisy alpha channel masking a flat `--foreground` fill gets the colour from
//    the token instead of baking it into the SVG, which is what keeps one asset
//    working in both modes.
// 2. The grain does NOT flicker, and it does NOT drift. Animating it is the
//    usual party trick, but the grain is a MASK on a page-tall layer: moving it
//    re-rasterizes the whole mask every frame, on the tallest element on the
//    page. The smoke below moves instead, and it moves UNDER a static grain,
//    which is exactly how film reads — the emulsion is fixed, the subject is not.
// 3. The smoke is `transform` on a handful of small, self-contained plumes —
//    never `background-position`, never the gradient stops. A transform on a
//    fixed-size box is a compositor job with no repaint; animating a gradient's
//    geometry re-paints it. That is also why the plumes are their OWN elements
//    at explicit sizes rather than more layers on `.film__light`: that element
//    is inset:0, i.e. as tall as the document, so promoting it would allocate a
//    page-sized texture, and rotating it would swing its contents across the
//    whole page instead of stirring them locally. They are centred with a static
//    `margin-left`, not `translate(-50%)`, so the animated `transform` carries no
//    layout offset a keyframe could drop.
//    The key light (`.film__light`) stays ANCHORED — the comment above about one
//    physical light source still holds. Smoke passes through the beam; the beam
//    does not wander.
// 4. `filter: blur()` is for the PLUMES and nothing else. A radial gradient's
//    falloff is linear in alpha, which still reads as a defined shape with a
//    findable centre; the blur is what turns each blob into fog. It is affordable
//    only because a plume is a small fixed-size box with a STATIC filter and an
//    animated transform/opacity, so the offscreen pass happens once per layer and
//    every frame after it is a composite. Never put it on `.film__light` or
//    `.film__grain` — both are inset:0, i.e. as tall as the document, so a blur
//    there is a full-page offscreen pass on every paint (and on the grain it would
//    dissolve the specks the mask exists to make).
//
// Purely decorative: `pointer-events-none` + `aria-hidden`.
</script>

<template>
  <div class="film" aria-hidden="true">
    <div class="film__light" />
    <div class="film__smoke">
      <div class="film__plume film__plume--a" />
      <div class="film__plume film__plume--b" />
      <div class="film__plume film__plume--c" />
    </div>
    <div class="film__grain" />
  </div>
</template>

<style scoped>
/* Fills the shell: header, main and footer, edge to edge. */
.film {
  position: absolute;
  inset: 0;
  z-index: -10;
  overflow: hidden;
  pointer-events: none;
}

.film__light,
.film__smoke,
.film__grain {
  position: absolute;
  inset: 0;
}

/*
 * Tonal wash: one key light — a tight core inside a wide halo — both centred on
 * `50% 22rem`, so they read as a single source rather than as stacked gradients.
 * 22rem down from the top of the box puts it through the hero's centre with the
 * header (4rem) included, and the halo carries on into the first section below
 * rather than stopping with the hero.
 */
.film__light {
  background:
    radial-gradient(
      38rem 20rem at 50% 22rem,
      color-mix(in oklab, var(--foreground) 10%, transparent),
      transparent 72%
    ),
    radial-gradient(
      64rem 34rem at 50% 22rem,
      color-mix(in oklab, var(--foreground) 5%, transparent),
      transparent 78%
    );
  background-repeat: no-repeat;
}

/*
 * Smoke: three plumes crossing the anchored beam. Each is a `closest-side` blob,
 * so it has already reached `transparent` well inside its own box — which is
 * what lets it be moved, scaled and turned without an edge ever entering frame.
 * They are sized and offset to sit in the hero's band; the shell's `overflow:
 * hidden` clips whatever drifts out sideways, same as the wash.
 *
 * Nothing phase-locks. The three periods (19s / 23s / 29s) share no small common
 * multiple, so the arrangement takes hours to repeat, and the negative delays
 * start each plume mid-path so the layer has no visible beginning. Each path
 * returns to its own origin at 100%, so the loop closes without a rewind.
 *
 * `--plume-blur` is roughly a tenth of the plume's own width, which is what makes
 * the blob read as fog rather than as a soft-edged shape. It has to stay
 * proportional: the same absolute radius that dissolves the small plume barely
 * touches the large one.
 *
 * Each `--plume-tone` is then the pre-blur tone DIVIDED by what the blur leaves of
 * the peak, and the peak is the number to hold: it is the plume's core, the only
 * part with enough alpha to read at all against the wash. A radius comparable to
 * the plume's minor radius is a large convolution against a linear ramp, and it
 * keeps only ~0.66–0.69 of the apex — so the honest tones for parity are
 * 10.6%/8.8%/8.75%, not the 8%/7%/7% that a "bump it a point" guess produces
 * (that lands 20% dim). The mid-body ends up ~⅓ up on the unblurred version, which
 * is not a miss: holding the peak while spreading the falloff IS more total ink,
 * and it is what makes the plume read as fog with the same weight rather than as a
 * fainter blob.
 *
 * So retuning the blur means retuning the tone WITH it, in the same direction. At
 * constant tone a blurrier plume is a dimmer one, and the eye reads dimmer as the
 * fog going away, not as it going soft. Solve it, do not nudge it.
 *
 * The `animation-name`s are written OUT, per plume, and MUST stay that way. Vue's
 * scoped-style compiler rewrites `@keyframes film-plume-a` to
 * `film-plume-a-<scopeId>` and patches the literal names in `animation` /
 * `animation-name` to match — but it patches TEXT, so a name arriving through a
 * custom property (`animation: var(--plume-path) …`) is left pointing at a
 * keyframes rule that no longer exists. Nothing throws; the plumes just sit
 * still. Every other per-plume value is fine as a variable — only the name is
 * load-bearing.
 */
.film__plume {
  position: absolute;
  left: 50%;
  background: radial-gradient(
    closest-side,
    color-mix(in oklab, var(--foreground) var(--plume-tone), transparent),
    transparent
  );
  filter: blur(var(--plume-blur));
  animation-duration: var(--plume-period);
  animation-delay: var(--plume-delay);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

.film__plume--a {
  top: -6rem;
  margin-left: -34rem;
  width: 60rem;
  height: 36rem;
  animation-name: film-plume-a;
  --plume-blur: 6rem;
  --plume-tone: 10.6%;
  --plume-period: 19s;
  --plume-delay: -4s;
}

.film__plume--b {
  top: 6rem;
  margin-left: -8rem;
  width: 44rem;
  height: 30rem;
  animation-name: film-plume-b;
  --plume-blur: 4.5rem;
  --plume-tone: 8.8%;
  --plume-period: 23s;
  --plume-delay: -11s;
}

.film__plume--c {
  top: 16rem;
  margin-left: -28rem;
  width: 34rem;
  height: 24rem;
  animation-name: film-plume-c;
  --plume-blur: 3.5rem;
  --plume-tone: 8.75%;
  --plume-period: 29s;
  --plume-delay: -7s;
}

/*
 * Every stop moves the plume on all three axes at once — drift, swell, turn —
 * because a blob that only translates reads as a sliding shape, and one that
 * only scales reads as a pulse. The opacity ride is the density change that
 * sells it as smoke rather than as a light.
 *
 * The travel is large on purpose. What the eye picks up is luminance CHANGE over
 * time, and these blobs are single-digit-alpha grey: a few rem over half a minute
 * produces a per-frame delta below the threshold where anything reads as moving
 * at all. The amplitude is what buys the motion; the long period is what keeps it
 * calm.
 */
@keyframes film-plume-a {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
    opacity: 0.85;
  }
  33% {
    transform: translate3d(9rem, -5rem, 0) scale(1.28) rotate(9deg);
    opacity: 1;
  }
  66% {
    transform: translate3d(-7rem, 4.5rem, 0) scale(0.82) rotate(-7deg);
    opacity: 0.55;
  }
}

@keyframes film-plume-b {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
    opacity: 0.6;
  }
  40% {
    transform: translate3d(-10rem, 5.5rem, 0) scale(0.84) rotate(-10deg);
    opacity: 1;
  }
  70% {
    transform: translate3d(6rem, -6rem, 0) scale(1.32) rotate(7deg);
    opacity: 0.8;
  }
}

@keyframes film-plume-c {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
    opacity: 1;
  }
  35% {
    transform: translate3d(8rem, 5rem, 0) scale(1.35) rotate(-9deg);
    opacity: 0.5;
  }
  75% {
    transform: translate3d(-9rem, -4rem, 0) scale(0.86) rotate(11deg);
    opacity: 0.9;
  }
}

/*
 * Reduced motion keeps the plumes, drops the animation: they settle on their 0%
 * pose, which is a still tonal variation rather than a flat wash.
 */
@media (prefers-reduced-motion: reduce) {
  .film__plume {
    animation: none;
  }
}

/*
 * Grain: one flat `--foreground` fill, punched through by tiled noise.
 * `stitchTiles` is what makes the 140px tile seamless; the alpha gamma pushes
 * the flat 50%-grey average down into sparse, crisp specks, so the layer reads
 * as grain rather than as a grey tint. It runs the full height at one weight —
 * at 5.5% behind content there is nothing to fade out for.
 */
.film__grain {
  background-color: var(--foreground);
  opacity: 0.055;
  --film-grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='gamma' exponent='2.4'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)'/%3E%3C/svg%3E");
  -webkit-mask-image: var(--film-grain);
  mask-image: var(--film-grain);
  -webkit-mask-size: 140px 140px;
  mask-size: 140px 140px;
  -webkit-mask-repeat: repeat;
  mask-repeat: repeat;
}

.dark .film__grain {
  opacity: 0.075;
}
</style>
