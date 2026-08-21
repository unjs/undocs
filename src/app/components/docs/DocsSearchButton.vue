<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { useDocsSearch } from "@app/composables/useDocsSearch.ts";
import { useUndocsT } from "@app/composables/useUndocsT.ts";
import { cn } from "@app/utils/cn.ts";
import Icon from "@app/components/global/Icon.vue";
import Kbd from "@app/components/ui/Kbd.vue";

defineProps<{
  /** Full-width labelled field — the drawer's own shape (see `AppHeader`). */
  expanded?: boolean;
}>();

const appConfig = useAppConfig();
const { toggle } = useDocsSearch();
const { t } = useUndocsT();

/**
 * The modifier is per-platform, but the platform is only knowable on the client
 * — so the SSR render and the FIRST client render must both show `⌘` (the
 * hydration-parity invariant), and non-Apple visitors get `Ctrl` swapped in
 * `onMounted`. Same shape as `ColorModeButton`'s `mounted` gate.
 */
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
    :aria-label="t('search.aria')"
    :class="
      cn(
        'group inline-flex h-(--size-small) shrink-0 cursor-pointer items-center justify-between rounded-md border border-border bg-transparent pl-2 pr-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        expanded ? 'w-full' : 'w-[200px] lg:w-[220px]',
      )
    "
    @click="toggle"
  >
    <span class="flex min-w-0 items-center gap-1.5">
      <Icon v-if="expanded" name="i-lucide-search" class="size-4 shrink-0" />
      <span class="min-w-0 truncate text-copy-14">{{ t("search.button") }}</span>
    </span>
    <Kbd v-if="!expanded" :keys="[metaKey, 'K']" class="ml-0.5 inline-flex" />
  </button>
</template>
