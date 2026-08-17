<script setup lang="ts">
// Publish the measured height because narrow status text can wrap; all sticky
// offsets consume this token. ClientOnly keeps offline state out of hydration.
import { computed, onBeforeUnmount, ref, watch } from "vue";
import Icon from "@app/components/global/Icon.vue";
import { useOffline } from "@app/composables/useOffline.ts";

const props = withDefaults(
  defineProps<{
    variant?: "offline";
  }>(),
  { variant: "offline" },
);

const VARIANTS = {
  offline: {
    icon: "i-lucide-cloud-off",
    message: "You’re offline — parts of these docs may not load.",
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
