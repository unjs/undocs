<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useDocsSearch } from "@app/composables/useDocsSearch.ts";
import Icon from "@app/components/global/Icon.vue";
import Kbd from "@app/components/ui/Kbd.vue";
/**
 * DocsSearchField — a full-width, `--size-large` stand-in for a search input
 * that opens the palette with `query` already typed in. The not-found page's
 * "search further": the label shows the words the palette will open with, so
 * clicking it reads as continuing a search, not starting one.
 *
 * Like `DocsSearchButton` it is a `<button>`, not an `<input>` — the palette
 * owns the real input — and it shows `⌘` on SSR and the first client render,
 * swapping `Ctrl` in `onMounted` (hydration parity).
 */
const props = defineProps<{
  /** Words to open the palette with; the label falls back to a placeholder. */
  query?: string;
}>();

const { openWith } = useDocsSearch();

const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

const isApple = () => /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent || "");

const metaKey = computed(() => (mounted.value && !isApple() ? "Ctrl" : "⌘"));
</script>

<template>
  <button
    type="button"
    aria-label="Search documentation"
    class="flex h-(--size-large) w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    @click="openWith(props.query || '')"
  >
    <Icon name="i-lucide-search" class="size-4 shrink-0" />
    <span class="min-w-0 flex-1 truncate text-left text-copy-16">
      <template v-if="props.query">
        Search for <span class="text-foreground">{{ props.query }}</span>
      </template>
      <template v-else>Search the docs</template>
    </span>
    <Kbd :keys="[metaKey, 'K']" class="hidden sm:inline-flex" />
  </button>
</template>
