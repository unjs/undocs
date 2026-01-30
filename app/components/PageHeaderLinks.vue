<script setup lang="ts">
import { useClipboard } from "@vueuse/core";
import { useRuntimeConfig } from "#imports";

const route = useRoute();
const appBaseURL = useRuntimeConfig().app?.baseURL || "/";

const { copy, copied } = useClipboard();

const markdownLink = computed(() => `${window?.location?.origin}${appBaseURL}raw${route.path}.md`);
const items = [
  {
    label: "Copy Markdown Link",
    icon: "i-lucide-link",
    onSelect() {
      copy(markdownLink.value);
    },
  },
  {
    label: "View as Markdown",
    icon: "i-simple-icons:markdown",
    target: "_blank",
    to: markdownLink.value,
  },
  {
    label: "Open in ChatGPT",
    icon: "i-simple-icons:openai",
    target: "_blank",
    to: `https://chatgpt.com/?hints=search&q=${encodeURIComponent(`Read ${markdownLink.value} so I can ask questions about it.`)}`,
  },
  {
    label: "Open in Claude",
    icon: "i-simple-icons:anthropic",
    target: "_blank",
    to: `https://claude.ai/new?q=${encodeURIComponent(`Read ${markdownLink.value} so I can ask questions about it.`)}`,
  },
];

async function copyPage() {
  const page = await $fetch<string>(`/raw${route.path}.md`);
  copy(page);
}
</script>

<template>
  <UFieldGroup size="sm">
    <UButton
      label="Copy Page"
      :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
      color="neutral"
      variant="soft"
      :ui="{
        leadingIcon: 'text-neutral size-3.5',
      }"
      @click="copyPage"
    />

    <UDropdownMenu
      size="sm"
      :items="items"
      :content="{
        align: 'end',
        side: 'bottom',
        sideOffset: 8,
      }"
    >
      <UButton
        icon="i-lucide-chevron-down"
        color="neutral"
        variant="soft"
        class="border-l border-muted"
      />
    </UDropdownMenu>
  </UFieldGroup>
</template>
