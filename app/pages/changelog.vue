<script setup lang="ts">
import { eachDayOfInterval, isSameDay, isToday } from 'date-fns'

interface GithubRelease {
  id: number
  tag: string
  author: string
  name: string
  draft: boolean
  prerelease: boolean
  createdAt: string
  publishedAt: string
  markdown: string
  html: string
}

const { docs } = useAppConfig()
// const github = docs?.github ?? undefined
const github = 'unjs/nitro'
console.log(`https://ungh.cc/repos/${github}/releases`)
const { data: res } = await useFetch(`https://ungh.cc/repos/${github}/releases`)

console.log('>>', res.value)

if (!res?.value?.releases) {
  showError({
    statusCode: 404,
    statusMessage: 'Changelog not found!',
  })
}

const TITLE = `${github} changelog`
const TITLE_HTML = `<span class="text-primary">${github}</span> changelog`
const DESCRIPTION = `Follow the latest releases and updates happening on the repository`

const dates = computed(() => {
  const first = res.value.releases[res.value.releases.length - 1]
  const last = res.value.releases[0]
  if (!first) return []

  const days = eachDayOfInterval({ start: new Date(first.publishedAt), end: new Date() }).reverse()

  return days.map((day) => {
    return {
      day,
      latest: isSameDay(day, last.publishedAt),
      release: res.value.releases.find((release) => isSameDay(new Date(release.publishedAt), day)),
    }
  })
})

useHead({
  titleTemplate: '%s %separator UnJS',
})

useSeoMeta({
  title: TITLE,
  description: DESCRIPTION,
})
</script>

<template>
  <div class="relative px-4 sm:px-6 lg:px-8">
    <ULandingHero align="center" class="md:py-32" :ui="{ title: 'sm:text-6xl' }" :description="DESCRIPTION" :links="[
      {
        label: 'View on GitHub',
        icon: 'simple-icons:github',
        to: `https://github.com/${github}`,
        target: '_blank',
        size: 'md',
        color: 'white',
      },
    ]">
      <LandingBackground />

      <template #title>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span v-html="TITLE_HTML" />
      </template>
    </ULandingHero>

    <UPageBody>
      <div class="h-[96px] w-0.5 bg-gray-200 dark:bg-gray-800 mx-auto rounded-t-full" />

      <div v-for="(date, index) in dates" :key="index"
        class="relative py-3 min-h-[24px] flex items-center justify-center">
        <div class="h-full w-0.5 bg-gray-200 dark:bg-gray-800 absolute top-0 inset-x-[50%] -ml-[1px] flex-shrink-0" />

        <template v-if="date.release || isToday(date.day)">
          <div class="flex items-start gap-6 sm:gap-8 relative w-[50%]"
            :class="index % 2 === 0 ? 'translate-x-[50%] -ml-2' : '-translate-x-[50%] ml-2 flex-row-reverse'">
            <div
              class="h-[8px] w-[8px] bg-gray-400 dark:bg-gray-400 rounded-full z-[1] mt-2 ring-2 ring-gray-300 dark:ring-gray-600 flex-shrink-0" />

            <ChangelogItem :github="github" :date="date" :right-side="index % 2 !== 0" />
          </div>
        </template>
      </div>

      <div class="h-[96px] w-0.5 bg-gray-200 dark:bg-gray-800 mx-auto rounded-b-full" />
    </UPageBody>
  </div>
</template>
