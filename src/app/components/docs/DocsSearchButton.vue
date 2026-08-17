<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { useDocsSearch } from "@app/composables/useDocsSearch.ts";
import { cn } from "@app/utils/cn.ts";
import Icon from "@app/components/global/Icon.vue";
import Kbd from "@app/components/ui/Kbd.vue";
/**
 * DocsSearchButton — Geist's header search control (vercel.com/geist).
 *
 * One `<button>` in two shapes, not two buttons: the 200/220px labelled field
 * the header carries, and — with `expanded` — a full-width one for the mobile
 * drawer. Geist ships a square icon-only variant for the narrow bar; we have no
 * use for it, because below the shell threshold the header drops the search
 * entirely and the drawer's field has the room to stay labelled.
 *
 * Geist's field carries NO magnifier — the label ("Search Geist") is the
 * affordance, and the ⌘K chip sits flush right at `justify-between`. That is
 * what makes it read as an input rather than a button. `expanded` adds the
 * glyph and drops the chip: it leads a drawer that only opens below `md`, i.e.
 * on a viewport with no keyboard to hint at, where the icon is what names the
 * field at a glance.
 *
 * Height is `--size-small` (the Geist control ladder, as in `Button.ts`) and
 * the label takes `text-copy-14`, not `text-button-14`: this is placeholder
 * text, so it stays regular weight and muted.
 */
defineProps<{
  /** Full-width labelled field — the drawer's own shape (see `AppHeader`). */
  expanded?: boolean;
}>();

const appConfig = useAppConfig();
const { toggle } = useDocsSearch();

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
    aria-label="Search documentation"
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
      <span class="min-w-0 truncate text-copy-14">Search</span>
    </span>
    <Kbd v-if="!expanded" :keys="[metaKey, 'K']" class="ml-0.5 inline-flex" />
  </button>
</template>
