<script setup lang="ts">
import { computed, inject, type Ref } from "vue";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { mobileNavLinks } from "@app/utils/nav.ts";
import type { NavItem } from "@server/content/types.ts";
import AppHeaderVersionsMenu from "@app/components/app/AppHeaderVersionsMenu.vue";
import ColorModeSwitch from "@app/components/ColorModeSwitch.vue";
import DocsNavigation from "@app/components/docs/DocsNavigation.vue";
import DocsSearchButton from "@app/components/docs/DocsSearchButton.vue";
import DocsSectionTabs from "@app/components/docs/DocsSectionTabs.vue";
import IconMenuToggle from "@app/components/IconMenuToggle.vue";
// import Separator from "@app/components/ui/Separator.vue";
import SiteHeader from "@app/components/layout/SiteHeader.vue";
import SocialMenu from "@app/components/SocialMenu.vue";
import AppLink from "@app/components/app/AppLink.ts";
const appConfig = useAppConfig();

const navigation = inject<Ref<NavItem[]>>("navigation");

// The whole tree, reshaped for a collapsible drawer — see `mobileNavLinks`. Top-
// level links outside the docs tree (currently Blog) live at the trailing end of
// the section-tabs bar on desktop; below its `md` breakpoint they come through
// here instead.
const mobileLinks = computed(() => mobileNavLinks(navigation?.value));
</script>

<template>
  <SiteHeader to="/">
    <template #left>
      <!-- The name truncates rather than widening this track and dragging the
           centred search off centre (see `SiteHeader`). -->
      <AppLink
        to="/"
        class="focus-visible:outline-brand min-w-0 font-bold text-xl text-foreground flex items-end gap-1.5"
        :aria-label="appConfig.site.name"
      >
        <img
          :src="appConfig.docs.logo"
          :alt="`${appConfig.site.name} logo`"
          class="h-7 w-7 shrink-0"
        />
        <span class="select-none truncate">
          {{ appConfig.site.name }}
        </span>
      </AppLink>
      <AppHeaderVersionsMenu v-if="appConfig.docs.versions?.length" />
    </template>

    <!-- Search takes the header's centre track at `lg+`; below that it leads the
         right-hand cluster (see `SiteHeader`), icon-only under `md`. -->
    <template #default>
      <DocsSearchButton />
    </template>

    <template #right>
      <ColorModeSwitch />
      <!-- <Separator orientation="vertical" class="mx-1 h-5" /> -->
      <SocialMenu />
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
