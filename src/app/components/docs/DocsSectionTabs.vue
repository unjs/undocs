<script setup lang="ts">
import { computed } from "vue";
import { useWindowScroll } from "@vueuse/core";
import { useRoute } from "@app/router";
import { cn } from "@app/utils/cn";
import { useSectionTabs } from "@app/composables/useSectionTabs";
import Container from "@app/components/Container.vue";
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink";
// Secondary, horizontal "section switcher" bar that sits directly under the
// header (inspired by reka-ui's DocTopbar). Each top-level docs section becomes
// a tab with an icon + label and an underline active indicator, so switching
// sections is a first-class action separate from the deep sidebar tree.
//
// Visibility + tab list come from `useSectionTabs` so the sticky sidebars stay
// in sync with whether this bar is on screen.
const route = useRoute();
const { tabs, visible } = useSectionTabs();

const isActive = (tab: { originalPath?: string; to?: string }) => {
  const base = tab.originalPath || tab.to || "";
  return base !== "" && route.path.startsWith(base);
};

// Same scroll-reactive chrome as the header so the two bars fade in together.
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
        <AppLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          :class="
            cn(
              'inline-flex h-full shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors',
              isActive(tab)
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
            )
          "
        >
          <Icon v-if="tab.icon" :name="tab.icon" class="size-4 shrink-0" />
          <span class="whitespace-nowrap">{{ tab.label }}</span>
        </AppLink>
      </nav>
    </Container>
  </div>
</template>
