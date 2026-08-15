<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { useDocsSearch } from "@app/composables/useDocsSearch.ts";
import Icon from "@app/components/global/Icon.vue";
import Kbd from "@app/components/ui/Kbd.vue";
/**
 * DocsSearchButton — Geist's header search control (vercel.com/geist).
 *
 * One `<button>` in two shapes, not two buttons: a 32px square icon below `md`
 * and the 220px labelled field above it. Geist ships them as separate elements
 * (theirs also change shape — pill vs rounded); collapsing to one keeps a single
 * node in the a11y tree and one `aria-label` to maintain.
 *
 * Geist's field carries NO magnifier — the label ("Search Geist") is the
 * affordance, and the ⌘K chip sits flush right at `justify-between`. That is
 * what makes it read as an input rather than a button, so the icon only appears
 * in the collapsed shape, where there is no label to read.
 *
 * Height is `--size-small` (the Geist control ladder, as in `Button.ts`) and
 * the label takes `text-copy-14`, not `text-button-14`: this is placeholder
 * text, so it stays regular weight and muted.
 */
const appConfig = useAppConfig();
const { toggle } = useDocsSearch();

/**
 * The modifier is per-platform, but the platform is only knowable on the client
 * — so the SSR render and the FIRST client render must both show `⌘` (the
 * hydration-parity invariant), and non-Apple visitors get `Ctrl` swapped in
 * `onMounted`. Same shape as `ColorModeSwitch`'s `mounted` gate.
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
    class="group inline-flex h-(--size-small) w-(--size-small) shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:w-[200px] md:justify-between md:pl-2 md:pr-1.5 lg:w-[220px]"
    @click="toggle"
  >
    <Icon name="i-lucide-search" class="size-4 shrink-0 md:hidden" />
    <span class="hidden min-w-0 truncate text-copy-14 md:inline"> Search </span>
    <Kbd :keys="[metaKey, 'K']" class="ml-0.5 hidden md:inline-flex" />
  </button>
</template>
