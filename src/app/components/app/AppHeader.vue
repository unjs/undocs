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
import ThemeColorPicker from "@app/components/ThemeColorPicker.vue";
import AppLink from "@app/components/app/AppLink.ts";
const appConfig = useAppConfig();

const navigation = inject<Ref<NavItem[]>>("navigation");

// The whole tree, reshaped for a collapsible drawer — see `mobileNavLinks`. It
// carries the top-level links outside the docs tree (currently Blog) too, which
// the header renders as an icon in its action cluster at `md+`
// (`AppHeaderActions`) and the drawer is the only route to below that.
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

    <!-- Search takes the header's centre track at `md+`; below that the header
         drops it and the drawer opens on it (see `#body-header`). -->
    <template #default>
      <DocsSearchButton />
    </template>

    <!-- Color mode + socials: a row at `md+` only, so the narrow bar carries just
         the brand and the hamburger — the same controls sit at the drawer's foot. -->
    <template #right>
      <AppHeaderActions />
    </template>

    <template #toggle="{ open, toggle }">
      <IconMenuToggle :open="open" class="md:hidden" @click="toggle" />
    </template>

    <!-- The same control the header carries at `lg+`, at full drawer width. -->
    <template #body-header>
      <DocsSearchButton expanded />
    </template>

    <template #body>
      <DocsNavigation :navigation="mobileLinks" default-open :multiple="true" />
    </template>

    <!-- What `AppHeaderActions` renders at `lg+`, at the drawer's foot below it.
         The accent swatches come in flow and always-visible here: at `md+` they
         expand out of the mode toggle on hover, which a touch device has no way
         to ask for — so this row is how the setting is reachable at all below
         it. -->
    <template #body-footer>
      <div class="flex flex-col gap-3">
        <ThemeColorPicker layout="row" />
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1">
            <SocialButtons size="lg" />
          </div>
          <ColorModeButton />
        </div>
      </div>
    </template>
  </SiteHeader>

  <DocsSectionTabs />
</template>
