<script setup lang="ts">
import { Transition, computed, ref, watch } from "vue";
import { useWindowScroll } from "@vueuse/core";
import { useRoute } from "@app/router.ts";
import { cn } from "@app/utils/cn.ts";
import Container from "@app/components/Container.vue";
// Based on Nuxt UI `UHeader` component. Sticky, blurred top header.
//
// Slots:
//   - #left    logo / brand area
//   - default  centered content (search)
//   - #right   actions (color mode, socials)
//   - #toggle  scoped `{ open, toggle }` — mobile menu button
//   - #body    mobile drawer content (revealed when `open`)
//
// `lg` (1024px) is the DESKTOP THRESHOLD, and it is shared: this header, the
// docs sidebar (`PageAside`), the ToC (`DocsToc`) and the `Page` grid all flip
// at the same width, so the shell is never half-desktop. Moving one means moving
// all four. `xl` (1280px) was tried and reverted — the content column caps at
// 1220px, so waiting for 1280 left a 1024–1280 band running the hamburger drawer
// on screens with room to spare for the sidebar.
//
// On `lg+` the row is `grid-cols-[1fr_auto_1fr]`, so the default slot is centred
// on the CONTAINER, not on whatever space the brand and the actions leave over —
// two flex siblings of unequal width would push it off-centre by half their
// difference. The side tracks are equal by construction, so the brand carries
// `min-w-0` (and truncates) rather than widening its track and shifting the
// centre.
//
// Below `lg` the row is a plain flex line with only TWO clusters: the brand at
// the left edge, everything else at the right. The default slot keeps its DOM
// position (one node, one tab order at every width) and joins the right cluster
// through `ml-auto` — dropped again at `lg`, where the same class on a grid item
// would right-align the search inside its track and undo the centring above.
// Letting it sit next to the brand instead boxes the bar into three clusters
// with a hole in the middle, which is what a 32px icon has nothing to centre
// against.
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
      <div class="flex h-16 items-center gap-2 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-4">
        <div class="flex min-w-0 items-center gap-2">
          <slot name="left" />
        </div>

        <div class="ml-auto flex min-w-0 items-center justify-center lg:ml-0">
          <slot />
        </div>

        <div class="flex items-center gap-1 lg:ml-auto">
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
