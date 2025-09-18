<script lang="ts" setup>
const appConfig = useAppConfig()
</script>

<template>
  <p class="text-sm text-muted">
    <span class="text-default font-medium">
      <NuxtLink
        class="text-highlighted hover:text-primary"
        :to="`https://github.com/${appConfig.docs.github}`"
        target="_blank"
        >{{ appConfig.site.name }}
      </NuxtLink>
    </span>
    &nbsp;<span class="text-muted">{{ appConfig.docs.shortDescription.replace(/\.$/, '') }}</span>.
  </p>
</template>
