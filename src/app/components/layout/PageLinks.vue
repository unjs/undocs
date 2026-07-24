<script setup lang="ts">
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink";
// Based on Nuxt UI `UPageLinks` component. Renders small inline icon links (e.g. "Edit this page").
// A passed `class` falls through onto the root.
interface PageLink {
  icon?: string;
  label?: string;
  to?: string;
  target?: string;
  [key: string]: any;
}

defineProps<{
  links: PageLink[];
}>();
</script>

<template>
  <div class="flex flex-col gap-2">
    <AppLink
      v-for="(link, index) in links"
      :key="index"
      :to="link.to"
      :target="link.target"
      class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
    >
      <Icon v-if="link.icon" :name="link.icon" class="size-4 shrink-0" />
      <span>{{ link.label }}</span>
    </AppLink>
  </div>
</template>
