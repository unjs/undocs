<script lang="ts" setup>
const appConfig = useAppConfig();
</script>

<template>
  <p class="text-sm text-gray-500 dark:text-gray-400">
    <span class="text-gray-900 dark:text-white">{{ appConfig.site.name }}</span
    >.
  </p>
</template>
