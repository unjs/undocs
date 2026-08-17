import { computed } from "vue";
import { useRoute } from "@app/router.ts";
import { useDocsNav } from "@app/composables/useDocsNav.ts";
import { useLanding } from "@app/composables/useLanding.ts";
import { isBlogPath } from "@app/utils/nav.ts";

// Shared source of truth for the horizontal section-tabs sub-nav (rendered by
// `DocsSectionTabs`). The header renders the bar from `tabs`/`visible`; the
// sticky sidebars (`PageAside`, `DocsToc`) read `visible` to offset themselves
// below the extra 3rem of sticky chrome when the bar is showing.
export function useSectionTabs() {
  const docsNav = useDocsNav();
  const route = useRoute();
  const landing = useLanding();

  // Blog is a section too, but it is not part of the docs tree the tabs switch
  // between — it is a destination alongside them, and it lives in the header's
  // action cluster as an icon instead (`useBlogLink`, rendered by
  // `AppHeaderActions`), so it is dropped here rather than sorted in among the
  // docs sections. Which entry it is comes from the ROUTE (`isBlogPath`), not
  // from a "Blog" title: the section is titled after its index page, so a blog
  // called "News" would otherwise take a tab.
  const tabs = computed(() =>
    docsNav.links.filter((link) => link.to && link.label && !isBlogPath(link.to)),
  );

  // Two conditions, plus one exclusion.
  //
  // (1) More than one DOCS section to switch between, and (2) the docs actually
  // group their pages into sections. Flat documentation — every top-level entry
  // a single page — is fully served by the sidebar, and a tab bar above it that
  // repeated the same links would be pure duplication. In no-landing mode the
  // loose top-level pages are gathered into one synthetic section first
  // (`groupLoosePages`), so a docs set that mixes pages and sections satisfies
  // (2) and gets a bar covering both. The blog does not count toward (1): it no
  // longer renders here, so one section plus a blog is a bar with a single tab.
  //
  // The exclusion is the landing itself: it is not in any section, so there is
  // no tab to mark active. (A no-landing `/` IS in a section, and keeps the bar.)
  const visible = computed(
    () => docsNav.hasSections && tabs.value.length > 1 && !(landing.value && route.path === "/"),
  );

  return { tabs, visible };
}
