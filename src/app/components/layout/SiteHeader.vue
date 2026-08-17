<script setup lang="ts">
import { Transition, computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useWindowScroll } from "@vueuse/core";
import { useRoute } from "@app/router.ts";
import { cn } from "@app/utils/cn.ts";
import Container from "@app/components/Container.vue";
// Based on Nuxt UI `UHeader` component. Sticky, blurred top header.
//
// Slots:
//   - #left    logo / brand area
//   - default  centered content at `md+` only (search)
//   - #right   actions (color mode, socials)
//   - #toggle  scoped `{ open, toggle }` — mobile menu button
//   - #body-header  the drawer's top edge, above the scroller (search)
//   - #body    mobile drawer content (revealed when `open`)
//   - #body-footer  pinned to the drawer's bottom edge (color mode, socials)
//
// `md` (768px) is the SHELL THRESHOLD, and it is shared: this header, the docs
// sidebar (`PageAside`), the section-tabs bar (`DocsSectionTabs`) and `Page`'s
// left track all flip at the same width, so the shell is never half-desktop.
// Moving one means moving all of them. The ToC (`DocsToc`, and `Page`'s right
// track) is deliberately NOT one of them — it waits for `lg`, because it is
// what a 768–1024 viewport gives up to keep the sidebar and a readable content
// column. `lg` (1024px) was the threshold for all of it and read far too late:
// a laptop-width window ran the hamburger with room to spare. `xl` (1280px) was
// tried before that and reverted for the same reason.
//
// On `md+` the row is `grid-cols-[1fr_auto_1fr]`, so the default slot is centred
// on the CONTAINER, not on whatever space the brand and the actions leave over —
// two flex siblings of unequal width would push it off-centre by half their
// difference. The side tracks are equal by construction, so the brand carries
// `min-w-0` (and truncates) rather than widening its track and shifting the
// centre.
//
// Below `md` the default slot is HIDDEN, not re-placed: the bar carries the
// brand at the left edge and the toggle at the right (`ml-auto`, which at `md`
// only right-aligns the actions inside their own grid track). The drawer that
// toggle opens is where the centre content goes at that width — `#body-header`
// gives it the full drawer width instead of the sliver left between a search
// field and a hamburger.
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

// Growing past the shell threshold hides the drawer with CSS but would leave
// `open` — and with it the scroll lock — set, so a tablet rotated to landscape
// gets a page it cannot scroll and no visible drawer to close. Close it instead.
// `onMounted`, so no `matchMedia` read reaches the SSR render or the first
// client one (the hydration-parity invariant).
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
    <!-- Column, not a single scroller: the nav takes the leftover height and
         scrolls on its own so `#body-footer` stays pinned to the drawer's bottom
         edge whatever the tree's length. -->
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
