<script setup lang="ts">
// Keep animated layers height-bounded and animate only transforms/opacity; a
// page-sized filtered layer or animated gradient repaints an enormous surface.
// Animation names must remain literals: Vue's scoped-style transform rewrites
// literal keyframe names but cannot follow a name supplied through a CSS variable.
</script>

<template>
  <div class="fire" aria-hidden="true">
    <div class="fire__hearth" />
    <div class="fire__core" />
    <div class="fire__flames">
      <div class="fire__flame fire__flame--1" />
      <div class="fire__flame fire__flame--2" />
      <div class="fire__flame fire__flame--3" />
      <div class="fire__flame fire__flame--4" />
      <div class="fire__flame fire__flame--5" />
      <div class="fire__flame fire__flame--6" />
      <div class="fire__flame fire__flame--7" />
      <div class="fire__flame fire__flame--8" />
      <div class="fire__flame fire__flame--9" />
    </div>
    <div class="fire__embers">
      <div class="fire__ember fire__ember--1" />
      <div class="fire__ember fire__ember--2" />
      <div class="fire__ember fire__ember--3" />
      <div class="fire__ember fire__ember--4" />
      <div class="fire__ember fire__ember--5" />
      <div class="fire__ember fire__ember--6" />
      <div class="fire__ember fire__ember--7" />
      <div class="fire__ember fire__ember--8" />
    </div>
    <div class="fire__grain" />
  </div>
</template>

<style scoped>
.fire {
  position: absolute;
  inset: 0;
  z-index: -10;
  overflow: hidden;
  pointer-events: none;

  /* Keep large surfaces monochrome; reserve the project accent for tiny embers. */
  --fire: var(--foreground);
  --ash: var(--brand);

  --flame-unit: clamp(11rem, 24vw, 27rem);

  /* Tongue bottoms derive from this shared line. */
  --hearth-line: 36rem;
}

.fire__hearth,
.fire__core,
.fire__flames,
.fire__embers {
  position: absolute;
  left: 0;
  right: 0;
}

.fire__grain {
  position: absolute;
  inset: 0;
}

/* The gradient fades before its vertical box edge to avoid a blurred seam. */
.fire__hearth {
  top: 0;
  height: 60rem;
  background: radial-gradient(
    78% 32rem at 50% 28rem,
    color-mix(in oklab, var(--fire) 4.5%, transparent),
    transparent 82%
  );
  background-repeat: no-repeat;
  opacity: 0.86;
  animation: fire-hearth 7.3s ease-in-out -2.6s infinite;
}

/* Scale only on Y: the glow intentionally bleeds past both viewport edges. */
.fire__core {
  top: 20rem;
  height: 30rem;
  background:
    radial-gradient(
      30% 8rem at 33% 15rem,
      color-mix(in oklab, var(--fire) 3.6%, transparent),
      transparent 88%
    ),
    radial-gradient(
      26% 7rem at 70% 16rem,
      color-mix(in oklab, var(--fire) 3%, transparent),
      transparent 88%
    ),
    radial-gradient(
      80% 14rem at 50% 15rem,
      color-mix(in oklab, var(--fire) 7.5%, transparent),
      transparent 92%
    );
  opacity: 0.84;
  animation: fire-core 4.1s ease-in-out -1.3s infinite;
}

.fire__flames {
  top: 0;
  height: var(--hearth-line);
}

/* Tongues must overlap at every viewport width; their bottoms share the hearth. */
.fire__flame {
  position: absolute;
  top: calc(var(--hearth-line) - var(--flame-h));
  width: var(--flame-w);
  height: var(--flame-h);
  margin-left: calc(var(--flame-w) / -2);
  transform-origin: 50% 100%;
  background: radial-gradient(
    42% 42% at 50% 76%,
    color-mix(in oklab, var(--fire) var(--flame-tone), transparent) 0%,
    color-mix(in oklab, var(--fire) calc(var(--flame-tone) * 0.72), transparent) 36%,
    color-mix(in oklab, var(--fire) calc(var(--flame-tone) * 0.46), transparent) 62%,
    color-mix(in oklab, var(--fire) calc(var(--flame-tone) * 0.22), transparent) 82%,
    transparent 100%
  );
  filter: blur(calc(min(var(--flame-w), var(--flame-h)) / 19));
  animation-duration: var(--flame-period);
  animation-delay: var(--flame-delay);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

/* Static opacity matches each animation's 0% pose for reduced motion. */
.fire__flame--1 {
  left: 4%;
  opacity: 0.78;
  animation-name: fire-flame-a;
  --flame-w: calc(var(--flame-unit) * 1.1);
  --flame-h: 36rem;
  --flame-tone: 8.8%;
  --flame-period: 5.6s;
  --flame-delay: -2.1s;
}

.fire__flame--2 {
  left: 15%;
  opacity: 0.9;
  animation-name: fire-flame-d;
  --flame-w: calc(var(--flame-unit) * 0.86);
  --flame-h: 26rem;
  --flame-tone: 9.8%;
  --flame-period: 3.7s;
  --flame-delay: -0.7s;
}

.fire__flame--3 {
  left: 26%;
  opacity: 0.72;
  animation-name: fire-flame-c;
  --flame-w: calc(var(--flame-unit) * 1.18);
  --flame-h: 43rem;
  --flame-tone: 8.4%;
  --flame-period: 6.9s;
  --flame-delay: -1.2s;
}

.fire__flame--4 {
  left: 36%;
  opacity: 0.85;
  animation-name: fire-flame-b;
  --flame-w: calc(var(--flame-unit) * 0.9);
  --flame-h: 30rem;
  --flame-tone: 9.2%;
  --flame-period: 4.3s;
  --flame-delay: -3.4s;
}

.fire__flame--5 {
  left: 47%;
  opacity: 0.78;
  animation-name: fire-flame-a;
  --flame-w: calc(var(--flame-unit) * 1.22);
  --flame-h: 44rem;
  --flame-tone: 8.4%;
  --flame-period: 6.2s;
  --flame-delay: -4.6s;
}

.fire__flame--6 {
  left: 58%;
  opacity: 0.85;
  animation-name: fire-flame-b;
  --flame-w: calc(var(--flame-unit) * 0.92);
  --flame-h: 32rem;
  --flame-tone: 9.2%;
  --flame-period: 4.9s;
  --flame-delay: -1.8s;
}

.fire__flame--7 {
  left: 69%;
  opacity: 0.72;
  animation-name: fire-flame-c;
  --flame-w: calc(var(--flame-unit) * 1.06);
  --flame-h: 39rem;
  --flame-tone: 8.8%;
  --flame-period: 7.4s;
  --flame-delay: -5.3s;
}

.fire__flame--8 {
  left: 80%;
  opacity: 0.9;
  animation-name: fire-flame-d;
  --flame-w: calc(var(--flame-unit) * 0.88);
  --flame-h: 24rem;
  --flame-tone: 9.8%;
  --flame-period: 3.4s;
  --flame-delay: -2.6s;
}

.fire__flame--9 {
  left: 92%;
  opacity: 0.78;
  animation-name: fire-flame-a;
  --flame-w: calc(var(--flame-unit) * 1.16);
  --flame-h: 34rem;
  --flame-tone: 8.8%;
  --flame-period: 5.1s;
  --flame-delay: -3.9s;
}

/* Drop paired flames and embers together so mobile sparks still emerge from light. */
@media (max-width: 48rem) {
  .fire__flame:nth-child(even),
  .fire__ember:nth-child(even) {
    display: none;
  }
}

.fire__embers {
  top: 0;
  height: var(--hearth-line);
}

.fire__ember {
  position: absolute;
  top: calc(var(--hearth-line) - var(--ember-lift));
  width: var(--ember-size);
  height: var(--ember-size);
  border-radius: 50%;
  background: color-mix(in oklab, var(--ash) 26%, transparent);
  filter: blur(0.6px);
  opacity: 0;
  animation-duration: var(--ember-period);
  animation-delay: var(--ember-delay);
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.fire__ember--1 {
  left: 5%;
  animation-name: fire-ember-a;
  --ember-lift: 3rem;
  --ember-size: 3px;
  --ember-period: 9.4s;
  --ember-delay: -1.1s;
}

.fire__ember--2 {
  left: 16%;
  animation-name: fire-ember-b;
  --ember-lift: 7rem;
  --ember-size: 4px;
  --ember-period: 12.7s;
  --ember-delay: -6.3s;
}

.fire__ember--3 {
  left: 27%;
  animation-name: fire-ember-c;
  --ember-lift: 4rem;
  --ember-size: 3px;
  --ember-period: 10.1s;
  --ember-delay: -3.8s;
}

.fire__ember--4 {
  left: 37%;
  animation-name: fire-ember-a;
  --ember-lift: 9rem;
  --ember-size: 4px;
  --ember-period: 13.9s;
  --ember-delay: -8.2s;
}

.fire__ember--5 {
  left: 46%;
  animation-name: fire-ember-b;
  --ember-lift: 5rem;
  --ember-size: 3px;
  --ember-period: 8.6s;
  --ember-delay: -4.9s;
}

.fire__ember--6 {
  left: 59%;
  animation-name: fire-ember-c;
  --ember-lift: 8rem;
  --ember-size: 3px;
  --ember-period: 15.3s;
  --ember-delay: -11.4s;
}

.fire__ember--7 {
  left: 70%;
  animation-name: fire-ember-a;
  --ember-lift: 3rem;
  --ember-size: 3px;
  --ember-period: 11.2s;
  --ember-delay: -7.5s;
}

.fire__ember--8 {
  left: 81%;
  animation-name: fire-ember-b;
  --ember-lift: 6rem;
  --ember-size: 4px;
  --ember-period: 14.6s;
  --ember-delay: -2.9s;
}

@keyframes fire-hearth {
  0%,
  100% {
    opacity: 0.86;
  }
  14% {
    opacity: 0.96;
  }
  27% {
    opacity: 0.8;
  }
  41% {
    opacity: 1;
  }
  58% {
    opacity: 0.84;
  }
  73% {
    opacity: 0.94;
  }
  88% {
    opacity: 0.82;
  }
}

@keyframes fire-core {
  0%,
  100% {
    opacity: 0.84;
    transform: scaleY(1);
  }
  9% {
    opacity: 1;
    transform: scaleY(1.04);
  }
  21% {
    opacity: 0.74;
    transform: scaleY(0.98);
  }
  34% {
    opacity: 0.96;
    transform: scaleY(1.03);
  }
  47% {
    opacity: 0.78;
    transform: scaleY(1);
  }
  63% {
    opacity: 1;
    transform: scaleY(1.05);
  }
  78% {
    opacity: 0.82;
    transform: scaleY(1.01);
  }
  91% {
    opacity: 0.92;
    transform: scaleY(1.02);
  }
}

@keyframes fire-flame-a {
  0%,
  100% {
    transform: scale(1, 1) skewX(0deg);
    opacity: 0.78;
  }
  23% {
    transform: scale(0.88, 1.18) skewX(-5deg);
    opacity: 1;
  }
  44% {
    transform: scale(1.12, 0.92) skewX(3.5deg);
    opacity: 0.82;
  }
  66% {
    transform: scale(0.9, 1.24) skewX(-6.5deg);
    opacity: 0.95;
  }
  85% {
    transform: scale(1.06, 0.96) skewX(2deg);
    opacity: 0.68;
  }
}

@keyframes fire-flame-b {
  0%,
  100% {
    transform: scale(1, 1) skewX(0deg);
    opacity: 0.85;
  }
  19% {
    transform: scale(1.14, 0.88) skewX(4.5deg);
    opacity: 0.68;
  }
  41% {
    transform: scale(0.86, 1.28) skewX(-5.5deg);
    opacity: 1;
  }
  60% {
    transform: scale(1.06, 0.95) skewX(2.5deg);
    opacity: 0.78;
  }
  82% {
    transform: scale(0.92, 1.16) skewX(-3.5deg);
    opacity: 0.92;
  }
}

@keyframes fire-flame-c {
  0%,
  100% {
    transform: scale(1, 1) skewX(0deg);
    opacity: 0.72;
  }
  26% {
    transform: scale(0.9, 1.2) skewX(-6deg);
    opacity: 0.95;
  }
  45% {
    transform: scale(1.04, 1.04) skewX(1.5deg);
    opacity: 0.76;
  }
  64% {
    transform: scale(1.1, 0.9) skewX(5deg);
    opacity: 1;
  }
  87% {
    transform: scale(0.94, 1.14) skewX(-2.5deg);
    opacity: 0.84;
  }
}

@keyframes fire-flame-d {
  0%,
  100% {
    transform: scale(1, 1) skewX(0deg);
    opacity: 0.9;
  }
  21% {
    transform: scale(0.85, 1.3) skewX(4deg);
    opacity: 0.66;
  }
  38% {
    transform: scale(1.16, 0.88) skewX(-3deg);
    opacity: 1;
  }
  61% {
    transform: scale(0.9, 1.2) skewX(6deg);
    opacity: 0.76;
  }
  83% {
    transform: scale(1.08, 0.94) skewX(-2deg);
    opacity: 0.92;
  }
}

@keyframes fire-ember-a {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0;
  }
  18% {
    transform: translate3d(0.5rem, -5rem, 0) scale(0.98);
    opacity: 0.72;
  }
  36% {
    transform: translate3d(-0.7rem, -11rem, 0) scale(0.92);
    opacity: 0.42;
  }
  55% {
    transform: translate3d(-1.4rem, -17rem, 0) scale(0.84);
    opacity: 0.88;
  }
  78% {
    transform: translate3d(1.2rem, -24rem, 0) scale(0.7);
    opacity: 0.34;
  }
  100% {
    transform: translate3d(-0.4rem, -30rem, 0) scale(0.55);
    opacity: 0;
  }
}

@keyframes fire-ember-b {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0;
  }
  21% {
    transform: translate3d(-0.6rem, -5.6rem, 0) scale(0.96);
    opacity: 0.66;
  }
  40% {
    transform: translate3d(0.9rem, -12rem, 0) scale(0.9);
    opacity: 0.4;
  }
  58% {
    transform: translate3d(1.6rem, -17.6rem, 0) scale(0.84);
    opacity: 0.9;
  }
  80% {
    transform: translate3d(-1rem, -23rem, 0) scale(0.72);
    opacity: 0.44;
  }
  100% {
    transform: translate3d(1.4rem, -28rem, 0) scale(0.58);
    opacity: 0;
  }
}

@keyframes fire-ember-c {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0;
  }
  16% {
    transform: translate3d(0.3rem, -4.4rem, 0) scale(1);
    opacity: 0.6;
  }
  33% {
    transform: translate3d(-1.1rem, -10.4rem, 0) scale(0.94);
    opacity: 0.34;
  }
  52% {
    transform: translate3d(-1.8rem, -16rem, 0) scale(0.88);
    opacity: 0.86;
  }
  76% {
    transform: translate3d(0.9rem, -22rem, 0) scale(0.76);
    opacity: 0.4;
  }
  100% {
    transform: translate3d(-1.2rem, -27rem, 0) scale(0.6);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fire__hearth,
  .fire__core,
  .fire__flame,
  .fire__ember {
    animation: none;
  }
}

.fire__grain {
  background-color: var(--foreground);
  opacity: 0.055;
  --fire-grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='gamma' exponent='2.4'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)'/%3E%3C/svg%3E");
  -webkit-mask-image: var(--fire-grain);
  mask-image: var(--fire-grain);
  -webkit-mask-size: 140px 140px;
  mask-size: 140px 140px;
  -webkit-mask-repeat: repeat;
  mask-repeat: repeat;
}

.dark .fire__grain {
  opacity: 0.075;
}
</style>
