<script setup lang="ts">
/**
 * StatusBanner — a slim, fixed strip pinned to the very top of the viewport for
 * app-level status messages. Currently drives the `offline` notice; new statuses
 * can be added to `VARIANTS` (+ a `visible` case) without touching layout.
 *
 * Distinct from `Banner.vue`, which is the config-driven promotional banner that
 * sits in normal flow. This one is a fixed overlay (`z-100`, above the sticky
 * header) so it stays visible while scrolling. So it doesn't cover the
 * header/sidebars, it publishes its measured height as the global
 * `--status-banner-height` CSS variable: the page reserves that much space
 * (`body` padding) and every sticky top offset (header, section tabs, sidebars,
 * TOC) adds it. The variable defaults to `0px` and is cleared when the banner
 * hides, so layout is untouched when nothing is shown. Measured (not hard-coded)
 * because the message can wrap to two lines on narrow viewports.
 *
 * Wrapped in <ClientOnly> at the call site: the offline variant is a purely
 * client-side condition, so it never participates in SSR/first render.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import Icon from "@app/components/global/Icon.vue";
import { useOffline } from "@app/composables/useOffline";

const props = withDefaults(
  defineProps<{
    variant?: "offline";
  }>(),
  { variant: "offline" },
);

const VARIANTS = {
  offline: {
    icon: "i-lucide-cloud-off",
    message: "You’re offline — showing the last cached version of these docs.",
  },
} as const;

const content = computed(() => VARIANTS[props.variant]);

const offline = useOffline();
const visible = computed(() => {
  switch (props.variant) {
    case "offline":
      return offline.value;
    default:
      return false;
  }
});

const bannerEl = ref<HTMLElement | null>(null);
let observer: ResizeObserver | undefined;

const publishHeight = () => {
  const height = bannerEl.value?.offsetHeight ?? 0;
  document.documentElement.style.setProperty("--status-banner-height", `${height}px`);
};

const clearHeight = () => {
  document.documentElement.style.removeProperty("--status-banner-height");
};

// The banner element only exists while `visible` (`v-if`). Track the ref: when it
// mounts, keep `--status-banner-height` in sync via a ResizeObserver; when it
// unmounts (hidden), clear the variable so layout returns to normal.
watch(bannerEl, (el) => {
  observer?.disconnect();
  if (el) {
    observer = new ResizeObserver(publishHeight);
    observer.observe(el);
    publishHeight();
  } else {
    clearHeight();
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
  clearHeight();
});
</script>

<template>
  <div
    v-if="visible"
    ref="bannerEl"
    role="status"
    aria-live="polite"
    class="fixed inset-x-0 top-0 z-100 flex w-full items-center justify-center gap-1.5 bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground"
  >
    <Icon :name="content.icon" class="size-3.5 shrink-0" />
    <span>{{ content.message }}</span>
  </div>
</template>
