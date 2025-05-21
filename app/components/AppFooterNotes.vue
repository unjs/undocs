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
    is part of the
    <NuxtLink class="text-default font-medium hover:text-primary" to="https://unjs.io" target="_blank">UnJS ecosystem</NuxtLink>.
    Website made with
    <NuxtLink class="text-default font-medium hover:text-primary" to="https://undocs.unjs.io" target="_blank">UnDocs</NuxtLink> and
    <NuxtLink class="text-default font-medium hover:text-primary" to="https://ui.nuxt.com/pro" target="_blank">Nuxt UI Pro</NuxtLink>.
  </p>
</template>
