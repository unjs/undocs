import { computed, type ComputedRef } from "vue";
import { useDocsNav } from "@app/composables/useDocsNav.ts";
import { isBlogPath } from "@app/utils/nav.ts";

export interface BlogLink {
  label: string;
  icon: string;
  to: string;
  /** Is the reader inside the blog right now? */
  active: boolean;
}

/**
 * The blog's entry in the navigation tree, as the HEADER renders it.
 *
 * The blog is a destination alongside the docs rather than one of their
 * sections (see `isBlogPath`), so it rides the header's action cluster as a
 * single icon next to the socials instead of taking a tab in the section
 * switcher. It is read from the same tree every other consumer reads, and asked
 * for on the ROUTE — a blog titled "News" is still the blog.
 *
 * The icon comes from the nav item (`server/content/icons.ts` infers
 * `i-lucide-scroll-text` from the path); the fallback covers a tree whose blog
 * carries no icon, since an icon-only button with no icon is an empty square.
 * Keep the two spellings the same — the fallback is what a docs project with an
 * index-less `blog/` (path `/blog/first-post`, two segments deep, so no inferred
 * icon) actually renders in the header.
 */
export function useBlogLink(): ComputedRef<BlogLink | undefined> {
  const docsNav = useDocsNav();

  return computed(() => {
    const link = docsNav.links.find((item) => item.to && item.label && isBlogPath(item.to));
    if (!link) return undefined;
    return {
      label: link.label,
      icon: link.icon || "i-lucide-newspaper",
      to: link.to,
      active: !!link.active,
    };
  });
}
