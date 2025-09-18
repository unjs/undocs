<script lang="ts" setup>
const appConfig = useAppConfig()
</script>

<template>
  <p class="text-sm text-gray-500 dark:text-gray-400">
    <span class="text-gray-900 dark:text-white">{{ appConfig.site.name }}</span
    >. Website made with
    <NuxtLink class="text-gray-900 dark:text-white" to="https://ui.nuxt.com" target="_blank">Nuxt UI</NuxtLink>.
  </p>
</template>
