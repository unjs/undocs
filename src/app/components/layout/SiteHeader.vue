<script setup lang="ts">
import { Transition, computed, ref, watch } from "vue";
import { useWindowScroll } from "@vueuse/core";
import { useRoute } from "@app/router";
import { cn } from "@app/utils/cn";
import Container from "@app/components/Container.vue";
// Based on Nuxt UI `UHeader` component. Sticky, blurred top header.
//
// Slots:
//   - #left    logo / brand area
//   - default  centered nav (hidden below `lg`)
//   - #right   actions (search, color mode, socials)
//   - #toggle  scoped `{ open, toggle }` — mobile menu button
//   - #body    mobile drawer content (revealed when `open`)
//
// `to` is accepted for API parity (brand link); the `#left` slot usually renders
// its own link.
defineProps<{
  to?: string;
}>();

const open = ref(false);
const toggle = () => {
  open.value = !open.value;
};

// Scroll-reactive chrome: transparent while pinned at the very top, then fades in
// a blurred background + hairline border once the page scrolls. `useWindowScroll`
// is SSR-safe (y = 0 on the server), and the first client render is also at y = 0,
// so `scrolled` starts `false` on both sides — no hydration mismatch.
const { y } = useWindowScroll();
const scrolled = computed(() => y.value > 8);

// Close the mobile drawer on navigation.
const route = useRoute();
watch(
  () => route.path,
  () => {
    open.value = false;
  },
);

// Lock body scroll while the drawer is open (client-only; the opposite branch is
// DCE'd on the server where there's no `document`).
watch(open, (isOpen) => {
  if (import.meta.client) {
    document.body.style.overflow = isOpen ? "hidden" : "";
  }
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
      <div class="flex h-16 items-center gap-4">
        <div class="flex items-center gap-2">
          <slot name="left" />
        </div>

        <div class="hidden lg:flex flex-1 items-center justify-center">
          <slot />
        </div>

        <div class="ml-auto flex items-center gap-1">
          <slot name="right" />
          <slot name="toggle" :open="open" :toggle="toggle" />
        </div>
      </div>
    </Container>
  </header>

  <!-- Mobile menu: a left-anchored drawer sliding in over a scrim (inspired by
       reka-ui's DocTopbar). Rendered as siblings of <header> (not descendants) so
       the fixed panels position against the viewport, not the header's
       `backdrop-filter` containing block. Both sit below the sticky header (z-50)
       so its close toggle stays tappable. -->
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    leave-active-class="transition-opacity duration-150 ease-in"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="lg:hidden fixed inset-0 top-[calc(4rem+var(--status-banner-height))] z-30 bg-black/50"
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
      class="lg:hidden fixed inset-y-0 left-0 top-[calc(4rem+var(--status-banner-height))] z-40 w-4/5 max-w-xs overflow-y-auto border-r border-border bg-background"
    >
      <nav class="px-4 py-4">
        <slot name="body" />
      </nav>
    </aside>
  </Transition>
</template>
