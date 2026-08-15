import { computed } from "vue";
import { useRoute } from "@app/router.ts";
import { useDocsNav } from "@app/composables/useDocsNav.ts";
import { useLanding } from "@app/composables/useLanding.ts";

// Shared source of truth for the horizontal section-tabs sub-nav (rendered by
// `DocsSectionTabs`). The header renders the bar from `tabs`/`visible`; the
// sticky sidebars (`PageAside`, `DocsToc`) read `visible` to offset themselves
// below the extra 3rem of sticky chrome when the bar is showing.
export function useSectionTabs() {
  const docsNav = useDocsNav();
  const route = useRoute();
  const landing = useLanding();

  // Blog is a section too, but it is not part of the docs tree the tabs switch
  // between — it is split out as `trailingTabs` so the bar can push it to the
  // opposite end rather than sorting it among the docs sections.
  const links = computed(() => docsNav.links.filter((link) => link.to && link.label));

  const tabs = computed(() => links.value.filter((link) => link.title !== "Blog"));
  const trailingTabs = computed(() => links.value.filter((link) => link.title === "Blog"));

  // Two conditions, plus one exclusion.
  //
  // (1) More than one entry to switch between, and (2) the docs actually group
  // their pages into sections. Flat documentation — every top-level entry a
  // single page — is fully served by the sidebar, and a tab bar above it that
  // repeated the same links would be pure duplication. In no-landing mode the
  // loose top-level pages are gathered into one synthetic section first
  // (`groupLoosePages`), so a docs set that mixes pages and sections satisfies
  // (2) and gets a bar covering both.
  //
  // The exclusion is the landing itself: it is not in any section, so there is
  // no tab to mark active. (A no-landing `/` IS in a section, and keeps the bar.)
  const visible = computed(
    () =>
      docsNav.hasSections &&
      tabs.value.length + trailingTabs.value.length > 1 &&
      !(landing.value && route.path === "/"),
  );

  return { tabs, trailingTabs, visible };
}
