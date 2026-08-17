/**
 * Shaping and matching for the navigation tree the app renders.
 *
 * The tree `/api/docs/navigation` returns mirrors the content directory. This
 * module turns it into the tree the CHROME wants, which depends on whether `/`
 * is a landing page (see `useLanding`) — `app.vue` runs it once and provides the
 * result, so nothing downstream re-derives it.
 */
import { titleCase } from "@app/utils/title.ts";
import type { NavItem } from "@server/content/types.ts";

/**
 * Heading + icon for the synthetic section (see `groupLoosePages`). The pages it
 * gathers are the ones at the docs root, `/` among them, so it is the way back
 * to the front of the docs — not a category name. `lucide:house` is bundled
 * (`builtin-icons.ts`), so it renders with no Iconify round-trip.
 */
export const DEFAULT_SECTION_TITLE = "Home";
export const DEFAULT_SECTION_ICON = "i-lucide-house";

/**
 * Route-path matching for navigation highlighting.
 *
 * A plain `route.path.startsWith(item.path)` is wrong at both ends. The docs
 * root (`/`) is a prefix of EVERY path, so once it appears in the tree (see
 * `builder.ts` — it does whenever the docs have a root `index.md`) it claims
 * every page as its own; and `/guide` would claim `/guides-old`, which is a
 * different section. Both are fixed by matching on path SEGMENTS: a nav item
 * owns a route when it is that route, or its parent directory.
 */
export function isWithin(path: string, base: string | undefined): boolean {
  if (!base) return false;
  if (base === "/") return path === "/";
  return path === base || path.startsWith(base + "/");
}

/**
 * Is this route the blog, or a post in it?
 *
 * The blog is singled out in five places — the landing's "Get Started" CTA
 * (`firstDocsPage`), the mobile drawer (`mobileNavLinks`), the section tabs and
 * the sidebar's section anchors (`useSectionTabs`/`layouts/docs.vue`, which both
 * drop it), and the header's action cluster (`useBlogLink`, which is where it
 * renders instead) — and all five ask on the ROUTE, never on the title or on an
 * exact `/blog`. Both of the
 * obvious shortcuts are wrong: a `blog/` directory with no `index.md` borrows
 * its first post's path (`builder.ts` → `out.path = kids[0].path`), so its nav
 * item is `/blog/hello` and an `=== "/blog"` test misses it entirely; and its
 * title is whatever its index page is called, so a blog titled "News" defeats a
 * title test. Matching the prefix answers both, and `isWithin` keeps `/blogging`
 * out of it.
 */
export function isBlogPath(path: string | undefined): boolean {
  return isWithin(path ?? "", "/blog");
}

/**
 * Does this item, or anything beneath it, own `path`?
 *
 * Prefix matching alone is not enough once the tree contains a SYNTHETIC section
 * (below): its members share no common path, so the only way to ask "is the
 * reader inside this section" is to look at what it holds.
 */
export function navContains(item: NavItem, path: string): boolean {
  if (isWithin(path, item.path)) return true;
  return (item.children ?? []).some((child) => navContains(child, path));
}

/** A top-level entry that is a single page rather than a section of pages. */
function isLoosePage(item: NavItem): boolean {
  return !item.children?.length;
}

/**
 * Fold the loose top-level pages into one synthetic section.
 *
 * Only used in no-landing mode, where `/` is a docs page and the docs root can
 * hold pages (`index.md`, `another.md`) ALONGSIDE section directories
 * (`guide/`). Those loose pages have no section of their own, so the section
 * switcher (`DocsSectionTabs`) would have nothing to offer for them and they
 * would be reachable only from whichever section happened to be open. Gathering
 * them under one heading gives them a tab like every other section, and the tab
 * bar becomes a complete map of the docs.
 *
 * Left alone when it would not help: with no sections there is nothing to switch
 * between (the sidebar lists the pages directly), and with no loose pages there
 * is nothing to gather. The group takes the POSITION of the first page it
 * absorbs, so a docs set that opens with a section keeps it first.
 */
export function groupLoosePages(
  navigation: NavItem[],
  title = DEFAULT_SECTION_TITLE,
  icon = DEFAULT_SECTION_ICON,
): NavItem[] {
  const loose = navigation.filter(isLoosePage);
  if (loose.length === 0 || loose.length === navigation.length) return navigation;

  const group: NavItem = {
    title,
    icon,
    // The first page it holds — so the tab links somewhere, and `useDocsNav`
    // reads the group as having its own index rather than borrowing a path.
    path: loose[0].path,
    synthetic: true,
    children: loose,
  };

  const out: NavItem[] = [];
  let placed = false;
  for (const item of navigation) {
    if (!isLoosePage(item)) {
      out.push(item);
      continue;
    }
    if (!placed) {
      out.push(group);
      placed = true;
    }
  }
  return out;
}

/**
 * The navigation tree as the chrome renders it, for the current landing mode.
 *
 * With a landing at `/`, the docs-root item is dropped: a link to it would only
 * point back at the landing the reader is already being shown. Without one, `/`
 * is an ordinary page and stays, alongside the grouping above.
 */
export function docsNavTree(navigation: NavItem[] | null | undefined, landing: boolean): NavItem[] {
  const tree = navigation ?? [];
  if (landing) return tree.filter((item) => !item.root);
  return groupLoosePages(tree);
}

/**
 * Where the docs BEGIN — the route of the first page a reader should land on.
 *
 * The landing's lead CTA ("Get Started") used to be hardcoded to `/guide`, which
 * is only right for docs that happen to have a `guide/` directory; every other
 * project shipped a 404 on its most prominent button. It is read from the tree
 * instead: the first top-level entry, descending into sections until an actual
 * page is reached (a section's own path is its index page's, or — for an
 * index-less directory — borrowed from its first child, so descending lands on
 * the same route either way).
 *
 * Pass the tree the chrome renders (`docsNavTree`), not the raw response: in
 * landing mode the docs-root item is already stripped there, so the CTA cannot
 * point back at the landing itself.
 *
 * Blog is skipped: it is a destination alongside the docs rather than their
 * first chapter (`mobileNavLinks` treats it the same way). Returns `undefined`
 * for an empty tree — there is nowhere to get started, and the caller drops the
 * link rather than rendering a dead one.
 */
export function firstDocsPage(navigation: NavItem[] | null | undefined): string | undefined {
  for (const item of navigation ?? []) {
    if (isBlogPath(item.path)) continue;
    const path = item.children?.length ? firstDocsPage(item.children) : item.path;
    if (path) return path;
  }
  return undefined;
}

/** One crumb of the trail `[...slug].vue` renders above a page title. */
export interface BreadcrumbItem {
  label: string;
  icon?: string;
  /** Empty for an index-less section, which has no page of its own to link to. */
  to: string;
}

/**
 * The trail of SECTIONS a page sits in, outermost first.
 *
 * The top level is skipped: which section the reader is in is what the tab bar
 * (`DocsSectionTabs`) says, so repeating it here would only shorten the title.
 * What is left is the sub-sections between that tab and the page — a trail that
 * is empty for most docs and only earns its row on a nested tree.
 *
 * Containment is `navContains`, not a prefix test on the section's own path: an
 * index-less directory borrows its FIRST CHILD's path (`builder.ts`), so
 * `/api`-with-`a.md`-and-`b.md` is the item `/api/a`, and a reader on `/api/b`
 * would match nothing and get no trail at all. Asking what the section HOLDS is
 * right for that and for a synthetic section (`groupLoosePages`), whose members
 * share no prefix with it at all.
 */
export function navBreadcrumb(
  items: NavItem[] | null | undefined,
  path: string,
  level = 0,
): BreadcrumbItem[] {
  const parent = (items ?? []).find(
    (item) => navContains(item, path) && (item.children?.length ?? 0) > 0,
  );
  if (!parent) return [];
  const rest = navBreadcrumb(parent.children, path, level + 1);
  if (level === 0) return rest;
  return [
    { label: parent.title, icon: parent.icon, to: parent.page === false ? "" : parent.path },
    ...rest,
  ];
}

/**
 * Does this section have an index page of its OWN, listed as its first child?
 *
 * `builder.ts` re-adds a directory's `index.md` as the section's first child. An
 * index-LESS directory looks similar — it borrows its path from its first child —
 * but that child is an ordinary page, and the section is marked `page: false`.
 * Same rule as `DocsNavigation`'s `indexChild`.
 */
function hasOwnIndex(item: NavItem): boolean {
  return item.page !== false && !!item.children?.some((child) => child.path === item.path);
}

/**
 * How many rows the desktop sidebar would render for a subtree.
 *
 * Mirrors `DocsNavigation` in NON-collapsible mode (the shape `layouts/docs.vue`
 * uses): a group is one row — its header — plus its children, minus the
 * self-index child that header absorbs. Counting entries at the top level alone
 * would be wrong in both directions, since one entry can render a whole tree
 * beneath it and a group's own index page renders no row of its own.
 *
 * The layout uses it to decide whether the aside is worth a column at all: a
 * sidebar holding a single row is a link to the page the reader is already on.
 */
export function countNavRows(items: NavItem[] | null | undefined): number {
  let rows = 0;
  for (const item of items ?? []) {
    rows += 1;
    const children = item.children ?? [];
    rows += countNavRows(
      hasOwnIndex(item) ? children.filter((child) => child.path !== item.path) : children,
    );
  }
  return rows;
}

/**
 * The navigation tree as the MOBILE DRAWER renders it.
 *
 * The drawer's groups are collapsible, and that changes two things versus the
 * desktop sidebar:
 *
 * - a group header is a TOGGLE there, not a link, so `DocsNavigation` keeps a
 *   section's own index page as its first child instead of folding it into the
 *   header — otherwise that page would have nothing to reach it by. Header and
 *   child then read the same, because `builder.ts` titles a section FROM its
 *   index page ("Getting Started" over a "Getting Started" link), so the header
 *   falls back to naming the section's directory instead. NOT when the author
 *   named the section in its `.navigation.yml` (`titleFromConfig`): there is no
 *   repetition to break — the header says "Command Line" and the child says
 *   whatever the index page is called — and re-deriving would both discard
 *   explicit configuration and hand `cli/` back to `titleCase`, which knows
 *   "API" and no other acronym. That flag is the only thing that distinguishes
 *   the two cases; the titles themselves look identical by the time the tree
 *   reaches us;
 * - a section holding one page is not worth a toggle, so it collapses to a link.
 *
 * Blog is a destination rather than a section: its posts belong on its own index.
 *
 * Every branch returns a NEW object — a shallow copy, which is exactly the depth
 * the reshaping needs: only an item's OWN fields (`title`, `children`) are ever
 * rewritten here, and the `children` arrays are handed on as they came. These
 * items are the shared navigation tree, which the tabs and the desktop sidebar
 * read their titles from — retitling one in place would rename the section
 * everywhere the moment a reader opened the drawer. A spread per top-level entry
 * is a handful of objects on a tree with a handful of sections.
 */
export function mobileNavLinks(navigation: NavItem[] | null | undefined): NavItem[] {
  return (navigation ?? []).map((item) => {
    if (isBlogPath(item.path)) {
      return { ...item, children: undefined };
    }
    if (item.children?.length === 1) {
      return { ...item.children[0] };
    }
    // A synthetic section is named, not derived from a path — and its path is a
    // page's (`/`), which would rename it to "Home"'s first entry. An
    // author-named one is likewise already the name it should keep.
    if (!item.synthetic && !item.titleFromConfig && hasOwnIndex(item)) {
      return { ...item, title: titleCase(item.path.split("/").pop() || "") || item.title };
    }
    return { ...item };
  });
}
