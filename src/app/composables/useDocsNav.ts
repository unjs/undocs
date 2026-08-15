import { computed, inject, reactive, type Ref } from "vue";
import { useRoute } from "@app/router.ts";
import { titleCase } from "@app/utils/title.ts";
import { navContains } from "@app/utils/nav.ts";
import type { NavItem } from "@server/content/types.ts";

export function useDocsNav() {
  const navigation = inject<Ref<NavItem[]>>("navigation");
  const route = useRoute();

  const links = computed(() => {
    return (navigation?.value ?? []).map((item) => {
      // Which entry the reader is inside is decided on the item as it CAME —
      // the flattening below can drop the children the answer depends on, and a
      // synthetic section (`groupLoosePages`) holds pages that share no path
      // prefix with it, so only its contents can say.
      const source = item;

      // Flaten single child
      if (item.children?.length === 1) {
        item = {
          ...item,
          ...item.children[0],
          children: undefined,
        };
      }

      // Check if group index is not exists and default to first child. Computed
      // into a local rather than written back onto `item`: outside the flatten
      // above, `item` IS the injected tree's own object, which the tabs and the
      // sidebar share.
      const originalPath = item.path;
      const path =
        item.children?.length && !item.children.some((c) => c.path === originalPath)
          ? item.children[0].path
          : originalPath;

      return {
        ...item,
        path,
        to: path,
        originalPath,
        hasIndex: path === originalPath,
        label: item.title || titleCase(originalPath),
        active: navContains(source, route.path),
      };
    });
  });

  const activeSection = computed(() => links.value.find((l) => l.active));
  const activeLinks = computed(() => (activeSection.value?.children || []).filter(Boolean));

  /**
   * Does the tree group its pages into sections at all? Flat docs (every
   * top-level entry a single page) have nothing for the section switcher to
   * switch between — see `useSectionTabs`. Read from the tree as provided, since
   * `links` flattens a one-page section into a bare link.
   */
  const hasSections = computed(() =>
    (navigation?.value ?? []).some((item) => (item.children?.length ?? 0) > 0),
  );

  return reactive({
    links,
    activeSection,
    activeLinks,
    hasSections,
  });
}
