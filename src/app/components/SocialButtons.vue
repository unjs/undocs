<script setup lang="ts">
import { computed } from "vue";
import { useSocialLinks } from "@app/composables/useSocialLinks.ts";
import Button from "@app/components/ui/Button.vue";
import Tooltip from "@app/components/ui/Tooltip.vue";

defineProps({
  size: {
    type: String,
    default: "md",
  },
});

const links = useSocialLinks();

// x <> github: config order puts GitHub first, the row wants it last.
const socialLinks = computed(() => [...links.value].reverse());
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
