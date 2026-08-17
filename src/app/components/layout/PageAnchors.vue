<script setup lang="ts">
import { useRoute } from "@app/router.ts";
import { cn } from "@app/utils/cn.ts";
import { isWithin } from "@app/utils/nav.ts";
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink.ts";
interface AnchorLink {
  to?: string;
  path?: string;
  label?: string;
  title?: string;
  icon?: string;
  active?: boolean;
  [key: string]: any;
}

defineProps<{
  links: AnchorLink[];
}>();

const route = useRoute();
// Synthetic sections require the precomputed state because members do not share its path.
const isActive = (link: AnchorLink) => link.active ?? isWithin(route.path, link.to || link.path);
</script>

<template>
  <nav class="-mx-2 flex flex-col gap-0.5">
    <AppLink
      v-for="(link, index) in links"
      :key="index"
      :to="link.to || link.path"
      :class="
        cn(
          'flex h-(--size-large) items-center gap-2.5 rounded-md px-3 text-copy-14 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isActive(link)
            ? 'bg-brand/10 text-brand font-medium'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      "
    >
      <Icon v-if="link.icon" :name="link.icon" class="size-4 shrink-0" />
      <span class="truncate">{{ link.label || link.title }}</span>
    </AppLink>
  </nav>
</template>
