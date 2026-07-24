<script setup lang="ts">
import { useRoute } from "@app/router";
import { cn } from "@app/utils/cn";
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink";
// Renders top-level quick links (from `useDocsNav().links`) as a vertical
// icon + label list. Each link exposes both the `to`/`label` shape and the raw
// NavItem shape (`path`/`title`); we accept either.
interface AnchorLink {
  to?: string;
  path?: string;
  label?: string;
  title?: string;
  icon?: string;
  [key: string]: any;
}

defineProps<{
  links: AnchorLink[];
}>();

const route = useRoute();
const isActive = (link: AnchorLink) => {
  const base = link.to || link.path || "";
  return base !== "" && route.path.startsWith(base);
};
</script>

<template>
  <nav class="flex flex-col gap-0.5">
    <AppLink
      v-for="(link, index) in links"
      :key="index"
      :to="link.to || link.path"
      :class="
        cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
          isActive(link)
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
        )
      "
    >
      <Icon v-if="link.icon" :name="link.icon" class="size-4 shrink-0" />
      <span class="truncate">{{ link.label || link.title }}</span>
    </AppLink>
  </nav>
</template>
