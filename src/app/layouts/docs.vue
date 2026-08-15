<script setup lang="ts">
import { computed, nextTick, onMounted, watch } from "vue";
import { useRoute } from "@app/router.ts";
import { useDocsNav } from "@app/composables/useDocsNav.ts";
import { useSectionTabs } from "@app/composables/useSectionTabs.ts";
import { countNavRows } from "@app/utils/nav.ts";
import Container from "@app/components/Container.vue";
import DocsNavigation from "@app/components/docs/DocsNavigation.vue";
import Page from "@app/components/layout/Page.vue";
import PageAnchors from "@app/components/layout/PageAnchors.vue";
import PageAside from "@app/components/layout/PageAside.vue";
import Separator from "@app/components/ui/Separator.vue";
const docsNav = useDocsNav();
const route = useRoute();
// When the section-tabs bar is on screen it owns section switching, so the
// sidebar shows just that section's tree (the tab labels the section). The
// section's own index page stays in the tree as its first link. Nested group
// self-index children are still folded into their header by `DocsNavigation`.
const { visible: hasSectionTabs } = useSectionTabs();

// Section anchors shown above the tree when the tabs bar isn't on screen.
const anchorLinks = computed(() => docsNav.links.filter((l) => l.title !== "Blog"));

// Whether the left sidebar is worth rendering. Counted in ROWS, not entries —
// see `countNavRows`. It takes at least TWO to navigate: a sidebar with one row
// links to the page the reader is already on (a single-page docs set, or a
// section holding one page), so it is a column of chrome that can only be a
// no-op. When there is nothing to show, drop the `#left` slot entirely so the
// grid doesn't reserve its column and the content spans wide.
const hasSidebar = computed(
  () =>
    countNavRows(docsNav.activeLinks) + (hasSectionTabs.value ? 0 : anchorLinks.value.length) > 1,
);

// Keep the active entry visible when a deep-linked page loads (or on navigation)
// without yanking the whole window — scroll only the sidebar's own overflow.
onMounted(() => {
  watch(
    () => route.path,
    () => nextTick(revealActiveLink),
    { immediate: true },
  );
});

/**
 * Centre the active link inside the sidebar's own scrollport. Deliberately NOT
 * `el.scrollIntoView()`: that scrolls EVERY scrolling box up to the viewport, so
 * it also moves the window to centre the link — undoing the router's
 * scroll-to-top on every navigation, and yanking the page on a deep link.
 */
function revealActiveLink() {
  const el = document.querySelector("[data-active-docs-link]");
  const box = el && scrollport(el);
  // No scrollport → the tree fits, so the link is already in view.
  if (!el || !box) return;
  const link = el.getBoundingClientRect();
  const view = box.getBoundingClientRect();
  box.scrollTop += link.top - view.top - (box.clientHeight - link.height) / 2;
}

/** Nearest ancestor that actually scrolls vertically. */
function scrollport(el: Element): HTMLElement | undefined {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflowY = getComputedStyle(p).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && p.scrollHeight > p.clientHeight) {
      return p;
    }
  }
}
</script>

<template>
  <Container>
    <Page :ui="{ left: 'lg:col-span-2 pr-2 border-r border-border' }">
      <template v-if="hasSidebar" #left>
        <PageAside>
          <!-- Tabs bar present: it already labels + switches the active section,
               so the sidebar shows just that section's tree. -->
          <template v-if="hasSectionTabs">
            <DocsNavigation :navigation="docsNav.activeLinks" :collapsible="false" />
          </template>

          <!-- No tabs bar (single-section / landing docs): keep the section
               anchors above the tree so switching is still possible. -->
          <template v-else>
            <PageAnchors :links="anchorLinks" />
            <template v-if="docsNav.activeLinks?.length">
              <Separator type="dashed" class="py-6" />
              <DocsNavigation :navigation="docsNav.activeLinks" :collapsible="false" />
            </template>
          </template>
        </PageAside>
      </template>
      <slot />
    </Page>
  </Container>
</template>
