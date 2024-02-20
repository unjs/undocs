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
  <div
    class="bg absolute left-[calc(50%-4rem)] top-10 -z-10 transform-gpu blur-3xl sm:left-[calc(50%-18rem)] lg:left-48 lg:top-[calc(50%-30rem)] xl:left-[calc(50%-24rem)] right-0"
    aria-hidden="true"
  >
    <div
      class="aspect-[1108/632] w-full bg-gradient-to-r from-[rgb(var(--color-primary-DEFAULT))] to-white/20 opacity-35"
      :style="{ 'clip-path': `polygon(${poly})` }"
    ></div>
  </div>
</template>

<style scoped>
/* @keyframes fade {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

.bg {
  animation: fade 3s ease-in-out infinite;
} */

.bg > div {
  clip-path: circle(75%);
  transition: clip-path 2s;
}
</style>
