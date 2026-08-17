<script setup lang="ts">
import { computed } from "vue";
import { useWindowScroll } from "@vueuse/core";
import { useRoute } from "@app/router.ts";
import { cn } from "@app/utils/cn.ts";
import { isWithin } from "@app/utils/nav.ts";
import { useSectionTabs } from "@app/composables/useSectionTabs.ts";
import Container from "@app/components/Container.vue";
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink.ts";
// Inspired by reka-ui's `DocTopbar`.
const route = useRoute();
const { tabs, visible } = useSectionTabs();

// Synthetic sections require useDocsNav's precomputed active state because
// their member routes do not share the section path.
const isActive = (tab: { active?: boolean }) => !!tab.active;

const tabClass = (tab: { originalPath?: string; to?: string }) =>
  cn(
    "inline-flex h-full shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors",
    isActive(tab)
      ? "border-brand text-foreground"
      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
  );

const { y } = useWindowScroll();
const scrolled = computed(() => y.value > 8);
</script>

<template>
  <div
    v-if="visible"
    :class="
      cn(
        'sticky top-[calc(4rem+var(--status-banner-height))] z-40 hidden w-full border-y border-border transition-[background-color,backdrop-filter] duration-300 md:block',
        scrolled
          ? 'bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70'
          : 'bg-transparent',
      )
    "
  >
    <Container>
      <nav class="flex h-12 items-center gap-1 overflow-x-auto">
        <AppLink v-for="tab in tabs" :key="tab.to" :to="tab.to" :class="tabClass(tab)">
          <Icon v-if="tab.icon" :name="tab.icon" class="size-4 shrink-0" />
          <span class="whitespace-nowrap">{{ tab.label }}</span>
        </AppLink>
      </nav>
    </Container>
  </div>
</template>
