<script setup lang="ts">
import { Transition, computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useWindowScroll } from "@vueuse/core";
import { useRoute } from "@app/router.ts";
import { cn } from "@app/utils/cn.ts";
import Container from "@app/components/Container.vue";
// Based on Nuxt UI's `UHeader`, with drawer placement inspired by reka-ui's `DocTopbar`.
// Keep the `md` shell breakpoint aligned with Page, PageAside and
// DocsSectionTabs; the ToC deliberately waits until `lg`.
defineProps<{
  to?: string;
}>();

const open = ref(false);
const toggle = () => {
  open.value = !open.value;
};

// `useWindowScroll` starts at zero on SSR and hydration.
const { y } = useWindowScroll();
const scrolled = computed(() => y.value > 8);

const route = useRoute();
watch(
  () => route.path,
  () => {
    open.value = false;
  },
);

watch(open, (isOpen) => {
  if (import.meta.client) {
    document.body.style.overflow = isOpen ? "hidden" : "";
  }
});

// Crossing `md` must release a CSS-hidden drawer's scroll lock. Defer the
// matchMedia read until mount for hydration parity.
onMounted(() => {
  const desktop = window.matchMedia("(min-width: 48rem)");
  const close = () => {
    if (desktop.matches) open.value = false;
  };
  desktop.addEventListener("change", close);
  onUnmounted(() => desktop.removeEventListener("change", close));
});
</script>

<template>
  <header
    :class="
      cn(
        'sticky top-[var(--status-banner-height)] z-50 w-full transition-[background-color,backdrop-filter] duration-300',
        scrolled
          ? 'bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70'
          : 'bg-transparent',
      )
    "
  >
    <Container>
      <div class="flex h-16 items-center gap-2 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4">
        <div class="flex min-w-0 items-center gap-2">
          <slot name="left" />
        </div>

        <div class="hidden min-w-0 items-center justify-center md:flex">
          <slot />
        </div>

        <div class="ml-auto flex items-center gap-1">
          <slot name="right" />
          <slot name="toggle" :open="open" :toggle="toggle" />
        </div>
      </div>
    </Container>
  </header>

  <!-- Keep fixed panels outside the filtered header; filters establish a containing block. -->
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    leave-active-class="transition-opacity duration-150 ease-in"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="md:hidden fixed inset-0 top-[calc(4rem+var(--status-banner-height))] z-30 bg-black/50"
      aria-hidden="true"
      @click="open = false"
    />
  </Transition>

  <Transition
    enter-active-class="transition-transform duration-300 ease-out"
    leave-active-class="transition-transform duration-200 ease-in"
    enter-from-class="-translate-x-full"
    leave-to-class="-translate-x-full"
  >
    <aside
      v-if="open"
      class="md:hidden fixed inset-y-0 left-0 top-[calc(4rem+var(--status-banner-height))] z-40 flex w-4/5 max-w-xs flex-col border-r border-border bg-background"
    >
      <div v-if="$slots['body-header']" class="border-b border-border px-4 py-3">
        <slot name="body-header" />
      </div>
      <nav class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <slot name="body" />
      </nav>
      <div v-if="$slots['body-footer']" class="border-t border-border px-4 py-3">
        <slot name="body-footer" />
      </div>
    </aside>
  </Transition>
</template>
