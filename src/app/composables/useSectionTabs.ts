import { computed } from "vue";
import { useRoute } from "@app/router";
import { useDocsNav } from "@app/composables/useDocsNav";

// Shared source of truth for the horizontal section-tabs sub-nav (rendered by
// `DocsSectionTabs`). The header renders the bar from `tabs`/`visible`; the
// sticky sidebars (`PageAside`, `DocsToc`) read `visible` to offset themselves
// below the extra 3rem of sticky chrome when the bar is showing.
export function useSectionTabs() {
  const docsNav = useDocsNav();
  const route = useRoute();

  const tabs = computed(() =>
    docsNav.links.filter((link) => link.to && link.label && link.title !== "Blog"),
  );

  // More than one section to switch between, and never on the landing page.
  const visible = computed(() => tabs.value.length > 1 && route.path !== "/");

  return { tabs, visible };
}
