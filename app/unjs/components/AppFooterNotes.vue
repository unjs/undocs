<script lang="ts" setup>
const appConfig = useAppConfig()
</script>

<template>
  <p class="text-sm text-gray-500 dark:text-gray-400">
    <span class="text-gray-900 dark:text-white">
      <NuxtLink
        class="text-gray-900 dark:text-white"
        :to="`https://github.com/${appConfig.docs.github}`"
        target="_blank"
        >{{ appConfig.site.name }}
      </NuxtLink>
    </span>
    is part of the
    <NuxtLink class="text-gray-900 dark:text-white" to="https://unjs.io" target="_blank">UnJS ecosystem</NuxtLink>.
    Website made with
    <NuxtLink class="text-gray-900 dark:text-white" to="https://undocs.unjs.io" target="_blank">UnDocs</NuxtLink> and
    <NuxtLink class="text-gray-900 dark:text-white" to="https://ui.nuxt.com/pro" target="_blank">Nuxt UI Pro</NuxtLink>.
  </p>
</template>
