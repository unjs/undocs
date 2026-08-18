/**
 * Is `/` a landing page, or the docs' own root page?
 *
 * Two modes, one switch:
 *
 * - **Landing** (the default): `/` renders the hero/features page
 *   (`pages/landing.vue`) with no sidebar, and the docs-root `index.md` — if
 *   there is one — is rendered below the hero as extra copy. The root nav item
 *   is stripped from the tree, since a "Home" link would only point back at the
 *   landing.
 * - **No landing**: `/` is an ordinary docs page (`pages/[...slug].vue`, docs
 *   layout, left sidebar), and the root nav item stays in the tree as the first
 *   sidebar link.
 *
 * `resolveLanding` is the whole decision, kept as a pure function so it can be
 * unit-tested and so `app.vue` can run it once and provide the result — every
 * consumer (`AppLayout`, `useSectionTabs`, `pages/index.vue`) reads the same
 * answer rather than re-deriving it.
 */
import { inject, type Ref } from "vue";
import type { DocsConfig } from "../../../schema/config.d.ts";
import type { NavItem } from "@server/content/types.ts";

/**
 * Injection key for the resolved flag (provided by `app.vue`).
 *
 * A REGISTRY symbol, for the reason `router.ts` spells out: `app.vue` provides
 * it from the SSR entry's graph while `pages/index.vue` injects it from a
 * request-time `import()`, and in dev those two can briefly be separate
 * evaluations — with a unique symbol `useLanding()` would throw instead.
 */
export const LANDING_KEY = Symbol.for("undocs-landing");

/** Is this top-level item a section of pages rather than a single page? */
function isSection(item: NavItem): boolean {
  return (item.children?.length ?? 0) > 0;
}

/**
 * Decide whether `/` gets the landing page.
 *
 * A boolean settles it outright, in either direction — as does any non-empty
 * `landing` config, since an author who wrote a hero meant it, whatever the
 * content tree looks like. `landing: true` exists for the case configuration
 * alone cannot express: wanting the hero with nothing to put in it yet.
 *
 * Otherwise it is inferred from the shape of the docs, on one question: have the
 * pages been organised into SECTIONS?
 *
 * - Flat — every top-level entry a page — and the root page is simply the home
 *   page. That covers a docs set of one `README.md` as much as a handful of
 *   sibling pages; there is no structure for a hero to introduce, and putting
 *   one above the content would bury it.
 * - Sectioned, and `/` is above the structure rather than part of it. That is
 *   the common UnJS layout (a root `index.md` of marketing copy over `1.guide/`,
 *   `2.config/`, …), and its root page reads as the hero's supporting copy.
 *
 * With no root page at all there is nothing else `/` could serve, so the landing
 * is the only answer — flat or not.
 */
export function resolveLanding(
  docs: DocsConfig | undefined,
  navigation: NavItem[] | null | undefined,
): boolean {
  const landing = docs?.landing;
  if (typeof landing === "boolean") return landing;
  if (landing && Object.keys(landing).length > 0) return true;

  const top = navigation ?? [];
  if (!top.some((item) => item.root)) return true;
  return top.some(isSection);
}

/** The resolved flag, as provided by `app.vue`. `true` = `/` is the landing. */
export function useLanding(): Ref<boolean> {
  const landing = inject<Ref<boolean>>(LANDING_KEY);
  if (!landing) throw new Error("[undocs] useLanding() called outside of <app>");
  return landing;
}
