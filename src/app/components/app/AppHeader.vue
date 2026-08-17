<script setup lang="ts">
import { computed, inject, type Ref } from "vue";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { mobileNavLinks } from "@app/utils/nav.ts";
import type { NavItem } from "@server/content/types.ts";
import AppHeaderActions from "@app/components/app/AppHeaderActions.vue";
import AppHeaderVersionsMenu from "@app/components/app/AppHeaderVersionsMenu.vue";
import ColorModeButton from "@app/components/ColorModeButton.vue";
import DocsNavigation from "@app/components/docs/DocsNavigation.vue";
import DocsSearchButton from "@app/components/docs/DocsSearchButton.vue";
import DocsSectionTabs from "@app/components/docs/DocsSectionTabs.vue";
import IconMenuToggle from "@app/components/IconMenuToggle.vue";
import SiteHeader from "@app/components/layout/SiteHeader.vue";
import SocialButtons from "@app/components/SocialButtons.vue";
import AppLink from "@app/components/app/AppLink.ts";
const appConfig = useAppConfig();

const navigation = inject<Ref<NavItem[]>>("navigation");

// Mobile keeps destinations that desktop moves into its action cluster.
const mobileLinks = computed(() => mobileNavLinks(navigation?.value));
</script>

<template>
  <SiteHeader to="/">
    <template #left>
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

    <template #default>
      <DocsSearchButton />
    </template>

    <template #right>
      <AppHeaderActions />
    </template>

    <template #toggle="{ open, toggle }">
      <IconMenuToggle :open="open" class="md:hidden" @click="toggle" />
    </template>

    <template #body-header>
      <DocsSearchButton expanded />
    </template>

    <template #body>
      <DocsNavigation :navigation="mobileLinks" default-open :multiple="true" />
    </template>

    <template #body-footer>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1">
          <SocialButtons size="lg" />
        </div>
        <ColorModeButton />
      </div>
    </template>
  </SiteHeader>

  <DocsSectionTabs />
</template>
