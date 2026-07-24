<script setup lang="ts">
import { computed } from "vue";
import { useAppConfig } from "@app/composables/useAppConfig";
import { titleCase } from "@app/utils/title";
import Button from "@app/components/ui/Button.vue";
import Tooltip from "@app/components/ui/Tooltip.vue";
const appConfig = useAppConfig();

const props = defineProps({
  githubOnly: {
    type: Boolean,
    default: false,
  },
  size: {
    type: String,
    default: "md",
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
  <Tooltip v-for="link of socialLinks" :key="link.label" :text="link.label">
    <Button
      :aria-label="link.label"
      :icon="link.icon"
      :to="link.to"
      :size="size"
      target="_blank"
      rel="noopener noreferrer"
      color="neutral"
      variant="ghost"
    />
  </Tooltip>
</template>
