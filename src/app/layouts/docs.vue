<script setup lang="ts">
import { computed, nextTick, onMounted, watch } from "vue";
import { useRoute } from "@app/router";
import { useDocsNav } from "@app/composables/useDocsNav";
import { useSectionTabs } from "@app/composables/useSectionTabs";
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

// Whether the left sidebar has anything to render. When empty, drop the `#left`
// slot entirely so the grid doesn't reserve its column and the content spans wide.
const hasSidebar = computed(() =>
  hasSectionTabs.value
    ? docsNav.activeLinks.length > 0
    : anchorLinks.value.length > 0 || docsNav.activeLinks.length > 0,
);

// Keep the active entry visible when a deep-linked page loads (or on navigation)
// without yanking the whole window — scroll only the sidebar's own overflow.
onMounted(() => {
  watch(
    () => route.path,
    () =>
      nextTick(() => {
        document
          .querySelector("[data-active-docs-link]")
          ?.scrollIntoView({ block: "center", behavior: "auto" });
      }),
    { immediate: true },
  );
});
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
            <Separator v-if="docsNav.activeLinks?.length" type="dashed" class="py-6" />
            <DocsNavigation :navigation="docsNav.activeLinks" :collapsible="false" />
          </template>
        </PageAside>
      </template>
      <slot />
    </Page>
  </Container>
</template>
