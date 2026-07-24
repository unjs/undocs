<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "@app/router";
import Button from "@app/components/ui/Button.vue";
import ButtonGroup from "@app/components/ui/ButtonGroup.vue";
import DropdownMenu from "@app/components/ui/DropdownMenu.vue";
import { useClipboard } from "@vueuse/core";
import { $fetch } from "ofetch";
import { useRuntimeConfig } from "@app/composables/useRuntimeConfig";

const route = useRoute();
const appBaseURL = useRuntimeConfig().app?.baseURL || "/";

const { copy, copied } = useClipboard();

// `window` is undefined during SSR — guard it. Test `!import.meta.server` (not
// `import.meta.client`): `import.meta.server` is reliably `true` server-side in
// both dev and build (so the `window` branch is DCE'd there), whereas
// `import.meta.client` is left as `undefined` in the dev browser bundle.
const markdownLink = computed(() => {
  const origin = !import.meta.server ? window.location.origin : "";
  return `${origin}${appBaseURL}raw${route.path}.md`;
});
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
  <ButtonGroup size="sm">
    <Button
      label="Copy Page"
      :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
      color="neutral"
      variant="soft"
      :ui="{
        leadingIcon: 'text-neutral size-3.5',
      }"
      @click="copyPage"
    />

    <DropdownMenu
      size="sm"
      :items="items"
      :content="{
        align: 'end',
        side: 'bottom',
        sideOffset: 8,
      }"
    >
      <Button
        icon="i-lucide-chevron-down"
        color="neutral"
        variant="soft"
        class="border-l border-muted"
        aria-label="More page actions"
      />
    </DropdownMenu>
  </ButtonGroup>
</template>
