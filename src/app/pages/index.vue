<script setup lang="ts">
// Locale homes (`/`, `/ru`, …) share the landing when `resolveLanding` is true
// for that locale's merged docs config.
import { computed } from "vue";
import { useLanding } from "@app/composables/useLanding.ts";
import { useRoute } from "@app/router.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { getLocaleFromPath, localeHomePath, resolveI18nConfig } from "@app/utils/locale.ts";
import DocsPage from "@app/pages/[...slug].vue";
import LandingPage from "@app/pages/landing.vue";

const landing = useLanding();
const route = useRoute();
const i18nConfig = resolveI18nConfig(useAppConfig().docs as { lang?: string; i18n?: any });
const currentLocale = computed(() =>
  getLocaleFromPath(
    route.path,
    i18nConfig.localeCodes,
    i18nConfig.defaultLocale,
    i18nConfig.strategy,
  ),
);
const localeHome = computed(() =>
  localeHomePath(currentLocale.value, i18nConfig.defaultLocale, i18nConfig.strategy),
);
const showLanding = computed(() => landing.value && route.path === localeHome.value);
</script>

<template>
  <LandingPage v-if="showLanding" />
  <DocsPage v-else />
</template>
