<script setup lang="ts">
import { computed, inject, type Ref } from "vue";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { mobileNavLinks } from "@app/utils/nav.ts";
import { useLocaleDocsConfig } from "@app/composables/useLocaleDocsConfig.ts";
import { localeHomePath, resolveI18nConfig, getLocaleFromPath } from "@app/utils/locale.ts";
import { useRoute } from "@app/router.ts";
import type { NavItem } from "@server/content/types.ts";
import AppHeaderActions from "@app/components/app/AppHeaderActions.vue";
import AppHeaderVersionsMenu from "@app/components/app/AppHeaderVersionsMenu.vue";
import AppLogo from "@app/components/app/AppLogo.vue";
import ColorModeButton from "@app/components/ColorModeButton.vue";
import DocsNavigation from "@app/components/docs/DocsNavigation.vue";
import DocsSearchButton from "@app/components/docs/DocsSearchButton.vue";
import DocsSectionTabs from "@app/components/docs/DocsSectionTabs.vue";
import IconMenuToggle from "@app/components/IconMenuToggle.vue";
import SiteHeader from "@app/components/layout/SiteHeader.vue";
import SocialButtons from "@app/components/SocialButtons.vue";
import AppLink from "@app/components/app/AppLink.ts";
import LocaleSwitcher from "@app/components/app/LocaleSwitcher.vue";

const appConfig = useAppConfig();
const localeDocs = useLocaleDocsConfig();
const route = useRoute();
const i18nConfig = resolveI18nConfig(appConfig.docs as { lang?: string; i18n?: any });

const homeTo = computed(() => {
  const locale = getLocaleFromPath(
    route.path,
    i18nConfig.localeCodes,
    i18nConfig.defaultLocale,
    i18nConfig.strategy,
  );
  return localeHomePath(locale, i18nConfig.defaultLocale, i18nConfig.strategy);
});

const navigation = inject<Ref<NavItem[]>>("navigation");

// Mobile keeps destinations that desktop moves into its action cluster.
const mobileLinks = computed(() => mobileNavLinks(navigation?.value));
</script>

<template>
  <SiteHeader :to="homeTo">
    <template #left>
      <AppLink
        :to="homeTo"
        class="focus-visible:outline-brand min-w-0 font-bold text-xl text-foreground flex items-end gap-1.5"
        :aria-label="localeDocs.name || appConfig.site.name"
      >
        <AppLogo class="h-7 w-7 shrink-0" />
        <span class="select-none truncate">
          {{ localeDocs.name || appConfig.site.name }}
        </span>
      </AppLink>
      <AppHeaderVersionsMenu v-if="localeDocs.versions?.length" />
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
        <div class="flex items-center gap-1">
          <LocaleSwitcher />
          <ColorModeButton />
        </div>
      </div>
    </template>
  </SiteHeader>

  <DocsSectionTabs />
</template>
