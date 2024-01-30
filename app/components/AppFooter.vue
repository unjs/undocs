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
  <div class="w-full h-px bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
    <div class="bg-white dark:bg-gray-900 px-4">
      <UnJS class="w-5 h-5" />
    </div>
  </div>
  <UFooter :links="links">
    <template #left>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        <span class="text-gray-900 dark:text-white">{{ appConfig.site.name }}</span> is part of the <NuxtLink class="text-gray-900 dark:text-white" to="https://unjs.io" target="_blank">UnJS ecosystem</NuxtLink>.

        Website made with
      <NuxtLink class="text-gray-900 dark:text-white" to="https://ui.nuxt.com/pro" target="_blank">Nuxt UI Pro</NuxtLink>.
      </p>
    </template>

    <template #right>
      <UColorModeSelect />

      <UButton
        v-for="link of socialLinks"
        :key="link.label"
        :aria-label="link.label"
        :icon="link.icon"
        :to="link.href"
        target="_blank"
        v-bind="($ui.button.secondary as any)"
      ></UButton>
    </template>
  </UFooter>
</template>
