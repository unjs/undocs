<script setup lang="ts">
const appConfig = useAppConfig();

const props = defineProps({
  githubOnly: {
    type: Boolean,
    default: false,
  },
});

const socialLinks = computed(() => {
  return (
    Object.entries(
      props.githubOnly
        ? { github: appConfig.docs.github }
        : { github: appConfig.docs.github, ...appConfig.docs.socials },
    )
      .reverse() // x<>github
      // .filter(([key]) => props.socials?.includes(key) || !props.socials)
      .map(([key, value]) => {
        if (typeof value === "object") {
          return value;
        }
        if (typeof value === "string" && value) {
          return {
            // Workaround: i-simple-icons-x i-simple-icons-github
            icon: `i-simple-icons-${key}`,
            label: titleCase(key),
            to: /^https?:\/\//.test(value) ? value : `https://${key}.com/${value}`,
          };
        }
        return undefined;
      })
      .filter(Boolean)
  );
});
</script>
<template>
  <UTooltip v-for="link of socialLinks" :key="link.label" :text="link.label">
    <UButton
      :aria-label="link.label"
      :icon="link.icon"
      :to="link.to"
      target="_blank"
      rel="noopener noreferrer"
      color="neutral"
      variant="ghost"
    />
  </UTooltip>
</template>
