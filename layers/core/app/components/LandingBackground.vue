<script setup lang="ts">
function randomPolygon() {
  const points = []
  for (let i = 0; i < 18; i++) {
    points.push(`${Math.random() * 100}% ${Math.random() * 100}%`)
  }
  return points.join(', ')
}

const poly = useState(() => randomPolygon())

onMounted(() => {
  setInterval(() => {
    poly.value = randomPolygon()
  }, 1500)
})
</script>

<template>
  <div class="bg absolute left-0 right-0 top-0 -z-10 transform-gpu blur-3xl" aria-hidden="true">
    <div
      class="aspect-[1.7] w-full bg-gradient-to-r from-[rgb(var(--color-primary-DEFAULT))] to-white/10 lg:opacity-30 xs:opacity-50"
      :style="{ 'clip-path': `polygon(${poly})` }"
    ></div>
  </div>
</template>

<style scoped>
.bg > div {
  clip-path: circle(75%);
  transition: clip-path 2s;
}

.light .bg > div {
  opacity: 1 !important;
}
</style>
