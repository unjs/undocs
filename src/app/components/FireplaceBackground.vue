<script setup lang="ts">
// What is left of the fire: ash still drifting off it, each mote on its own
// heading. Keep the layer height-bounded and animate only transforms/opacity; a
// page-sized filtered layer or animated gradient repaints an enormous surface.
// Animation names must remain literals: Vue's scoped-style transform rewrites
// literal keyframe names but cannot follow a name supplied through a CSS variable.
</script>

<template>
  <div class="ashes" aria-hidden="true">
    <div class="ashes__drift">
      <div class="ashes__mote ashes__mote--1" />
      <div class="ashes__mote ashes__mote--2" />
      <div class="ashes__mote ashes__mote--3" />
      <div class="ashes__mote ashes__mote--4" />
      <div class="ashes__mote ashes__mote--5" />
      <div class="ashes__mote ashes__mote--6" />
      <div class="ashes__mote ashes__mote--7" />
      <div class="ashes__mote ashes__mote--8" />
    </div>
    <div class="ashes__grain" />
  </div>
</template>

<style scoped>
.ashes {
  position: absolute;
  inset: 0;
  z-index: -10;
  overflow: hidden;
  pointer-events: none;

  /* The accent is reserved for the motes: they are the only coloured thing here. */
  --ash: var(--brand);

  /* The band motes are scattered through; the layer has no other geometry. */
  --ash-field: 48rem;
}

.ashes__drift {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: var(--ash-field);
}

/* A mote carries its own heading as `--mote-dx`/`--mote-dy`; the keyframes only
 * walk fractions of that vector, so one path serves every direction. */
.ashes__mote {
  position: absolute;
  top: var(--mote-top);
  width: var(--mote-size);
  height: var(--mote-size);
  border-radius: 50%;
  background: color-mix(in oklab, var(--ash) 26%, transparent);
  filter: blur(1px);
  opacity: 0;
  animation-duration: var(--mote-period);
  animation-delay: var(--mote-delay);
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.ashes__mote--1 {
  left: 5%;
  animation-name: ash-drift-a;
  --mote-top: 31rem;
  --mote-dx: 9rem;
  --mote-dy: -22rem;
  --mote-size: 6px;
  --mote-period: 9.4s;
  --mote-delay: -1.1s;
}

.ashes__mote--2 {
  left: 16%;
  animation-name: ash-drift-b;
  --mote-top: 14rem;
  --mote-dx: -15rem;
  --mote-dy: -8rem;
  --mote-size: 8px;
  --mote-period: 12.7s;
  --mote-delay: -6.3s;
}

.ashes__mote--3 {
  left: 27%;
  animation-name: ash-drift-c;
  --mote-top: 22rem;
  --mote-dx: 7rem;
  --mote-dy: 17rem;
  --mote-size: 6px;
  --mote-period: 10.1s;
  --mote-delay: -3.8s;
}

.ashes__mote--4 {
  left: 37%;
  animation-name: ash-drift-a;
  --mote-top: 36rem;
  --mote-dx: -8rem;
  --mote-dy: -24rem;
  --mote-size: 8px;
  --mote-period: 13.9s;
  --mote-delay: -8.2s;
}

.ashes__mote--5 {
  left: 46%;
  animation-name: ash-drift-b;
  --mote-top: 9rem;
  --mote-dx: 18rem;
  --mote-dy: 6rem;
  --mote-size: 6px;
  --mote-period: 8.6s;
  --mote-delay: -4.9s;
}

.ashes__mote--6 {
  left: 59%;
  animation-name: ash-drift-c;
  --mote-top: 27rem;
  --mote-dx: -12rem;
  --mote-dy: 19rem;
  --mote-size: 6px;
  --mote-period: 15.3s;
  --mote-delay: -11.4s;
}

.ashes__mote--7 {
  left: 70%;
  animation-name: ash-drift-a;
  --mote-top: 18rem;
  --mote-dx: 14rem;
  --mote-dy: -13rem;
  --mote-size: 6px;
  --mote-period: 11.2s;
  --mote-delay: -7.5s;
}

.ashes__mote--8 {
  left: 81%;
  animation-name: ash-drift-b;
  --mote-top: 39rem;
  --mote-dx: -20rem;
  --mote-dy: -5rem;
  --mote-size: 8px;
  --mote-period: 14.6s;
  --mote-delay: -2.9s;
}

/* The three paths differ only in how unevenly they walk x against y, which is
 * what bends each one off its straight heading. */
@keyframes ash-drift-a {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0;
  }
  18% {
    transform: translate3d(calc(var(--mote-dx) * 0.13), calc(var(--mote-dy) * 0.18), 0) scale(0.98);
    opacity: 0.72;
  }
  36% {
    transform: translate3d(calc(var(--mote-dx) * 0.38), calc(var(--mote-dy) * 0.34), 0) scale(0.94);
    opacity: 0.42;
  }
  55% {
    transform: translate3d(calc(var(--mote-dx) * 0.52), calc(var(--mote-dy) * 0.58), 0) scale(0.88);
    opacity: 0.88;
  }
  78% {
    transform: translate3d(calc(var(--mote-dx) * 0.83), calc(var(--mote-dy) * 0.76), 0) scale(0.79);
    opacity: 0.34;
  }
  100% {
    transform: translate3d(var(--mote-dx), var(--mote-dy), 0) scale(0.7);
    opacity: 0;
  }
}

@keyframes ash-drift-b {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0;
  }
  21% {
    transform: translate3d(calc(var(--mote-dx) * 0.22), calc(var(--mote-dy) * 0.15), 0) scale(0.96);
    opacity: 0.66;
  }
  40% {
    transform: translate3d(calc(var(--mote-dx) * 0.33), calc(var(--mote-dy) * 0.44), 0) scale(0.92);
    opacity: 0.4;
  }
  58% {
    transform: translate3d(calc(var(--mote-dx) * 0.63), calc(var(--mote-dy) * 0.56), 0) scale(0.87);
    opacity: 0.9;
  }
  80% {
    transform: translate3d(calc(var(--mote-dx) * 0.74), calc(var(--mote-dy) * 0.85), 0) scale(0.8);
    opacity: 0.44;
  }
  100% {
    transform: translate3d(var(--mote-dx), var(--mote-dy), 0) scale(0.72);
    opacity: 0;
  }
}

@keyframes ash-drift-c {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0;
  }
  16% {
    transform: translate3d(calc(var(--mote-dx) * 0.19), calc(var(--mote-dy) * 0.12), 0) scale(1);
    opacity: 0.6;
  }
  33% {
    transform: translate3d(calc(var(--mote-dx) * 0.27), calc(var(--mote-dy) * 0.37), 0) scale(0.95);
    opacity: 0.34;
  }
  52% {
    transform: translate3d(calc(var(--mote-dx) * 0.58), calc(var(--mote-dy) * 0.49), 0) scale(0.89);
    opacity: 0.86;
  }
  76% {
    transform: translate3d(calc(var(--mote-dx) * 0.71), calc(var(--mote-dy) * 0.82), 0) scale(0.81);
    opacity: 0.4;
  }
  100% {
    transform: translate3d(var(--mote-dx), var(--mote-dy), 0) scale(0.71);
    opacity: 0;
  }
}

/* A mote is transparent at its 0% pose, so stopping the animation would leave
 * nothing but grain. Rest them mid-heading instead of at their start point. */
@media (prefers-reduced-motion: reduce) {
  .ashes__mote {
    animation: none;
    opacity: 0.34;
    transform: translate3d(calc(var(--mote-dx) * 0.5), calc(var(--mote-dy) * 0.5), 0) scale(0.88);
  }
}

.ashes__grain {
  position: absolute;
  inset: 0;
  background-color: var(--foreground);
  opacity: 0.1;
  --ashes-grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='gamma' exponent='1.7'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)'/%3E%3C/svg%3E");
  -webkit-mask-image: var(--ashes-grain);
  mask-image: var(--ashes-grain);
  -webkit-mask-size: 140px 140px;
  mask-size: 140px 140px;
  -webkit-mask-repeat: repeat;
  mask-repeat: repeat;
}

.dark .ashes__grain {
  opacity: 0.14;
}
</style>
