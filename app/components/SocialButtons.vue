<script setup lang="ts">
const appConfig = useAppConfig()

const socialLinks = computed(() => {
  return Object.entries({ github: appConfig.docs.github, ...appConfig.docs.socials })
    .reverse() // x<>github
    .map(([key, value]) => {
      if (typeof value === 'object') {
        return value
      }
      if (typeof value === 'string' && value) {
        return {
          // Workaround: i-simple-icons-x i-simple-icons-github
          icon: `i-simple-icons-${key}`,
          label: value,
          to: /^https?:\/\//.test(value) ? value : `https://${key}.com/${value}`,
        }
      }
      return undefined
    })
    .filter(Boolean)
})
</script>
<template>
  <UButton
    v-for="link of socialLinks"
    :key="link.label"
    :aria-label="link.label"
    :icon="link.icon"
    :to="link.to"
    target="_blank"
    rel="noopener noreferrer"
    v-bind="$ui.button.secondary as any"
  ></UButton>
</template>
