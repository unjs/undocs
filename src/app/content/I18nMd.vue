<script setup lang="ts">
/**
 * MDC wrapper around `@i18n-micro/vue` I18nT for Markdown:
 * `:i18n{keypath="demo.intro"}` / `<i18n-t keypath="demo.intro" />`
 */
import { computed } from "vue";
import { I18nT } from "@i18n-micro/vue";
import { useUndocsT } from "@app/composables/useUndocsT.ts";

const props = defineProps<{
  keypath?: string;
  path?: string;
  tag?: string;
}>();

const { t, i18n } = useUndocsT();
const key = computed(() => props.keypath || props.path || "");
</script>

<template>
  <I18nT v-if="i18n && key" :keypath="key" :tag="tag || 'span'" />
  <component :is="tag || 'span'" v-else>{{ t(key) }}</component>
</template>
