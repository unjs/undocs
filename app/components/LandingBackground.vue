<script setup lang="ts">
const points = useState(() => new Array(16).fill(0).map(() => [Math.random(), Math.random()]))

const poly = computed(() => points.value.map(([x, y]) => `${x * 100}% ${y * 100}%`).join(', '))

function jumpVal(val: number) {
  return Math.random() > 0.5 ? val + (Math.random() - 0.5) / 2 : Math.random()
}

let timeout
function jumpPoints() {
  for (let i = 0; i < points.value.length; i++) {
    points.value[i] = [jumpVal(points.value[i][0]), jumpVal(points.value[i][1])]
  }
  timeout = setTimeout(jumpPoints, 2000 + Math.random() * 1000)
}

onMounted(() => {
  jumpPoints()
  onUnmounted(() => clearTimeout(timeout))
})
</script>

<template>
  <div class="bg" aria-hidden="true">
    <div
      class="aspect-[1.7] h-full w-full lg:opacity-30 xs:opacity-50"
      :style="{
        'clip-path': `polygon(${poly})`,
      }"
    />
  </div>
</template>

<style scoped>
.bg {
  position: absolute;
  z-index: -10;
  inset: 0;
  transform: translate3d(0, 0, 0);
  filter: blur(70px);
}

.bg > div {
  clip-path: circle(75%);
  transition: clip-path 3s;
  background-image: radial-gradient(
    circle at center,
    color-mix(in srgb, var(--ui-primary) 30%, transparent),
    color-mix(in srgb, var(--ui-bg) 30%, transparent)
  );
}

.light .bg > div {
  opacity: 1 !important;
}
</style>
