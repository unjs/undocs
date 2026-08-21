<script setup lang="ts">
/**
 * Locale switcher using Geist DropdownMenu (matches undocs chrome tokens).
 * Items are real `to` links so crawlers/prerender see locale alternates.
 */
import { computed, inject, ref, type Ref } from "vue";
import { useI18n } from "@i18n-micro/vue";
import Button from "@app/components/ui/Button.vue";
import DropdownMenu from "@app/components/ui/DropdownMenu.vue";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { useRoute } from "@app/router.ts";
import { localeAlternatePath, resolveI18nConfig } from "@app/utils/locale.ts";
import { useUndocsT } from "@app/composables/useUndocsT.ts";
import type { NavItem } from "@server/content/types.ts";

const appConfig = useAppConfig();
const i18nConfig = resolveI18nConfig(appConfig.docs as { lang?: string; i18n?: any });
const { t } = useUndocsT();
const route = useRoute();
const rawNavigation = inject<Ref<NavItem[] | null | undefined>>("rawNavigation", ref(undefined));

const show = computed(() => i18nConfig.enabled && i18nConfig.locales.length > 1);
const i18n = i18nConfig.enabled ? useI18n() : null;

const currentLabel = computed(() => {
  const code = i18n?.locale.value ?? i18nConfig.defaultLocale;
  const loc = i18nConfig.locales.find((l) => l.code === code);
  return loc?.displayName || loc?.code || code;
});

const items = computed(() => {
  const current = i18n?.locale.value ?? i18nConfig.defaultLocale;
  const hash = route.hash || "";
  return [
    i18nConfig.locales.map((loc) => {
      const active = current === loc.code;
      if (active) {
        return {
          label: loc.displayName || loc.code,
          type: "checkbox" as const,
          checked: true,
          disabled: true,
        };
      }
      const to = localeAlternatePath(route.path, loc.code, rawNavigation.value, i18nConfig);
      return {
        label: loc.displayName || loc.code,
        to: `${to}${hash}`,
      };
    }),
  ];
});
</script>

<template>
  <DropdownMenu
    v-if="show"
    :items="items"
    size="sm"
    :content="{ align: 'end', side: 'bottom', sideOffset: 8 }"
  >
    <Button
      size="sm"
      color="neutral"
      variant="ghost"
      icon="i-lucide-languages"
      :aria-label="t('i18n.language')"
    >
      <span class="hidden sm:inline">{{ currentLabel }}</span>
    </Button>
  </DropdownMenu>
</template>
