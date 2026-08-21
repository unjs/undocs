<script setup lang="ts">
import { computed } from "vue";
import { useLocaleDocsConfig } from "@app/composables/useLocaleDocsConfig.ts";
import Button from "@app/components/ui/Button.vue";
import DropdownMenu from "@app/components/ui/DropdownMenu.vue";

const localeDocs = useLocaleDocsConfig();

const versions = computed(() => localeDocs.value.versions || []);

const activeVersion = computed(() => {
  return versions.value.find((version) => version.active) || versions.value[0];
});
const items = computed(() => {
  return versions.value.map((version) => {
    if (activeVersion.value === version) {
      return {
        label: version.label,
        type: "checkbox" as const,
        color: "primary" as const,
        checked: true,
      };
    }
    return {
      label: version.label,
      to: version.to,
    };
  });
});
</script>

<template>
  <DropdownMenu
    v-slot="{ open }"
    :modal="false"
    :items="items"
    :content="{ align: 'start' }"
    :ui="{ content: 'min-w-fit' }"
    size="xs"
    class="ml-1"
  >
    <Button
      :label="activeVersion?.label"
      variant="subtle"
      trailing-icon="i-lucide-chevron-down"
      size="xs"
      class="font-semibold rounded-full truncate"
      :class="[open && 'bg-brand/15']"
      :ui="{
        trailingIcon: ['transition-transform duration-200', open ? 'rotate-180' : undefined]
          .filter(Boolean)
          .join(' '),
      }"
    />
  </DropdownMenu>
</template>
