<script lang="ts" setup>
const appConfig = useAppConfig()

console.log(JSON.stringify(appConfig.docs, null, 2))
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
    &nbsp;<span class="text-muted">{{ appConfig.docs.shortDescription.replace(/\.$/, '') }}</span>

    &middot; Generated with
    <NuxtLink class="font-medium hover:text-primary" to="https://undocs.unjs.io" target="_blank">UnDocs </NuxtLink>
    and
    <NuxtLink class="font-medium hover:text-primary" to="https://ui.nuxt.com/pro" target="_blank">Nuxt UI Pro</NuxtLink
    >.
  </p>
</template>
