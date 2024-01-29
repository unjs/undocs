<script lang="ts" setup>
const appConfig = useAppConfig()

const socialLinks = computed(() => {
  return Object.entries({ github: appConfig.docs.github, ...appConfig.docs.socials })
    .map(([key, value]) => {
      if (typeof value === 'object') {
        return value
      } else if (typeof value === 'string' && value) {
        return {
          href: /^https?:\/\//.test(value) ? value : `https://${key}.com/${value}`,
          icon: `i-simple-icons-${key}`,
          label: value,
          rel: 'noopener noreferrer',
        }
      } else {
        return null
      }
    })
    .filter(Boolean)
})
</script>

<template>
  <div class="border-t border-gray-200 dark:border-gray-800">
    <footer class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:pb-30 flex flex-col gap-12 md:gap-20 rounded-lg">
      <div class="grid md:grid-cols-2 gap-y-6 gap-x-12 md:gap-x-25">
        <div class="grow flex flex-col gap-3 md:gap-6 max-w-sm">
          <NuxtLink to="/" class="flex items-center gap-2 text-xl">
            <img :src="appConfig.docs.logo" :alt="`${appConfig.docs.name} logo`" class="h-7 w-7" />
            <span class="mt-[2px] font-bold">
              {{ appConfig.docs.name }}
            </span>
          </NuxtLink>
          <p class="max-w-lg text-sm md:text-base text-gray-500 dark:text-gray-400 italic">
            {{ appConfig.docs.description }}
          </p>
        </div>
        <ul class="flex gap-2">
          <li>
            <UButton square to="https://unjs.io" rel="noopener" variant="ghost" color="gray" size="xl">
              <UnJS class="w-6 h-6" />
            </UButton>
          </li>
          <li v-for="link of socialLinks" :key="link.label">
            <UButton
              square
              :to="link.href"
              :rel="link.rel"
              target="_blank"
              :aria-label="`Follow us on ${link.label}`"
              size="xl"
              variant="ghost"
              color="gray"
              ><UIcon :name="link.icon" class="w-6 h-6" dynamic
            /></UButton>
          </li>
        </ul>
        <nav class="md:justify-self-end md:col-start-2 md:row-start-1 flex gap-x-2 gap-y-6 md:gap-10 text-[1.125rem]">
          <div
            v-if="appConfig.docs.footer?.menu"
            v-for="menuItem in appConfig.docs.footer.menu"
            :key="menuItem.title"
            class="flex flex-col gap-4"
          >
            <p class="font-bold text-gray-950 dark:text-gray-50">
              {{ menuItem.title }}
            </p>
            <ul class="flex flex-col gap-3 text-gray-500 dark:text-gray-400">
              <li v-for="item in menuItem.items" :key="item.url">
                <NuxtLink
                  :to="item.url"
                  :rel="item.rel"
                  :target="item.target"
                  class="hover:underline underline-offset-8"
                >
                  {{ item.title }}
                </NuxtLink>
              </li>
            </ul>
          </div>
        </nav>

        <div class="place-self-center md:place-self-end">
          <UColorModeSelect />
        </div>
      </div>
      <div class="text-sm dark:text-gray-400 text-center">
        <span class="capitalize font-medium">{{ appConfig.docs.name }}</span> is part of the
        <NuxtLink
          to="https://unjs.io"
          rel="noopener"
          class="underline underline-offset-2 hover:text-gray-950 dark:hover:text-white"
          >UnJS ecosystem</NuxtLink
        >. Website made with
        <NuxtLink
          to="https://ui.nuxt.com/pro"
          rel="noopener"
          class="underline underline-offset-2 hover:text-gray-950 dark:hover:text-white"
          >Nuxt UI Pro</NuxtLink
        >.
      </div>
    </footer>
  </div>
</template>
