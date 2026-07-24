<script setup lang="ts">
import { computed, inject } from "vue";
import { useAppConfig } from "@app/composables/useAppConfig";
import { useDocsNav } from "@app/composables/useDocsNav";
import { useRoute } from "@app/router";
import { cn } from "@app/utils/cn";
import { titleCase } from "@app/utils/title";
import AppHeaderVersionsMenu from "@app/components/app/AppHeaderVersionsMenu.vue";
import ColorModeSwitch from "@app/components/ColorModeSwitch.vue";
import DocsNavigation from "@app/components/docs/DocsNavigation.vue";
import DocsSearchButton from "@app/components/docs/DocsSearchButton.vue";
import DocsSectionTabs from "@app/components/docs/DocsSectionTabs.vue";
import IconMenuToggle from "@app/components/IconMenuToggle.vue";
import Separator from "@app/components/ui/Separator.vue";
import SiteHeader from "@app/components/layout/SiteHeader.vue";
import SocialButtons from "@app/components/SocialButtons.vue";
import AppLink from "@app/components/app/AppLink";
const appConfig = useAppConfig();

const navigation = inject("navigation");

// Top-level links that the section-tabs bar excludes (currently Blog) have no
// home on desktop otherwise — surface them as inline header links (lg+). Below
// lg the mobile drawer already renders them via `mobileLinks`.
const docsNav = useDocsNav();
const route = useRoute();
const headerLinks = computed(() =>
  docsNav.links.filter((link) => link.to && link.label && link.title === "Blog"),
);
const isActive = (link: { originalPath?: string; to?: string }) => {
  const base = link.originalPath || link.to || "";
  return base !== "" && route.path.startsWith(base);
};

const mobileLinks = computed(() => {
  return navigation.value.map((item) => {
    if (item.path === "/blog") {
      return {
        ...item,
        children: undefined,
      };
    }
    if (item.children?.length === 1) {
      return item.children[0];
    }
    const originalPath = item.path;
    if (item.children?.length && item.children.some((c) => c.path === originalPath)) {
      item.title = titleCase(originalPath);
    }
    return item;
  });
});
</script>

<template>
  <SiteHeader to="/">
    <template #left>
      <AppLink
        to="/"
        class="focus-visible:outline-primary shrink-0 font-bold text-xl text-foreground flex items-end gap-1.5"
        :aria-label="appConfig.site.name"
      >
        <img :src="appConfig.docs.logo" :alt="`${appConfig.site.name} logo`" class="h-7 w-7" />
        <span class="select-none">
          {{ appConfig.site.name }}
        </span>
      </AppLink>
      <AppHeaderVersionsMenu v-if="appConfig.docs.versions?.length" />
      <!-- Search sits inline next to the brand so it reads as a primary action,
           at every breakpoint (icon-only below sm, full pill above). -->
      <div class="ml-2">
        <DocsSearchButton />
      </div>
    </template>

    <template #right>
      <nav v-if="headerLinks.length" class="mr-1 hidden items-center gap-1 lg:flex">
        <AppLink
          v-for="link in headerLinks"
          :key="link.to"
          :to="link.to"
          :class="
            cn(
              'rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:text-foreground',
              isActive(link) ? 'text-foreground' : 'text-muted-foreground',
            )
          "
        >
          {{ link.label }}
        </AppLink>
      </nav>
      <Separator
        v-if="headerLinks.length"
        orientation="vertical"
        class="mx-1 hidden h-5 lg:block"
      />
      <ColorModeSwitch />
      <Separator orientation="vertical" class="mx-1 h-5" />
      <div class="hidden items-center sm:flex">
        <SocialButtons size="lg" />
      </div>
      <div class="flex items-center sm:hidden">
        <SocialButtons github-only size="lg" />
      </div>
    </template>

    <template #toggle="{ open, toggle }">
      <IconMenuToggle :open="open" class="lg:hidden" @click="toggle" />
    </template>

    <template #body>
      <DocsNavigation :navigation="mobileLinks" default-open :multiple="true" />
    </template>
  </SiteHeader>

  <DocsSectionTabs />
</template>
