<template>
  <div
    ref="target"
    class="flex flex-col transition-opacity duration-500"
    :class="targetIsVisible ? 'opacity-100' : 'opacity-25'"
  >
    <time
      class="flex-shrink-0 text-sm/6 font-semibold text-gray-500 dark:text-gray-400"
      :datetime="date.day.toISOString()"
    >
      {{ date.day.toLocaleString('en-us', { year: 'numeric', month: 'short', day: 'numeric' }) }}
    </time>

    <UBadge v-if="date.latest" class="w-fit mt-1" variant="outline" size="xs"> Latest </UBadge>

    <NuxtLink
      v-if="date.release"
      :to="`https://github.com/${date.github}/releases/tag/${date.release.name}`"
      target="_blank"
      class="text-gray-900 dark:text-white font-bold text-3xl mt-2 group hover:text-primary-500 dark:hover:text-primary-400 transition-[color]"
    >
      {{ date.release.name }}
    </NuxtLink>

    <MDC
      v-if="date.release?.markdown"
      :value="date.release.markdown"
      tag="div"
      class="changelog-item prose prose-primary dark:prose-invert mt-2"
    />
  </div>
</template>

<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'

defineProps<{
  date: {
    day: Date
    github: string
    latest: boolean
    release?: {
      name: string
      markdown: string
    }
  }
}>()

const target = ref(null)
const targetIsVisible = ref(false)

useIntersectionObserver(
  target,
  ([{ isIntersecting }]) => {
    targetIsVisible.value = isIntersecting
  },
  {
    rootMargin: '-68px 0px -68px 0px',
  },
)
</script>
