/**
 * useHideOthers — hide everything except one subtree from assistive technology.
 *
 * Ported from reka-ui's `useHideOthers` (MIT,
 * https://github.com/unovue/reka-ui), which delegates to the `aria-hidden`
 * package. Visually a modal covers the page; to a screen reader it does not —
 * without this, a reader can walk straight out of the dialog into the docs
 * behind it, which is the difference between a dialog and a div with a dark
 * backdrop. The focus trap does not help there: reader navigation is
 * independent of focus.
 *
 * The walk is the same one `aria-hidden` performs: climb from the target to
 * `<body>`, and at each level mark every SIBLING `aria-hidden="true"`, leaving
 * the ancestor chain itself readable. Skipped along the way are `<script>` /
 * `<style>` (not in the accessibility tree to begin with) and anything carrying
 * `aria-live` — hiding a live region would silence announcements the app is
 * making on purpose, including ones the dialog itself triggers.
 *
 * Refcounted per element, because two layers can overlap (the search palette
 * opened over the diagram lightbox) and the second one must not undo the first
 * one's work when it closes. The original attribute value is remembered so an
 * element that was ALREADY `aria-hidden` for its own reasons keeps that state
 * afterwards rather than being un-hidden by us.
 *
 * Module-level state again, and browser-only again: the composable returns
 * immediately under `import.meta.server` and the maps are keyed by DOM elements,
 * so nothing is written during SSR (see AGENTS.md's per-request-state
 * invariant).
 *
 * Dropped from reka: the `[popover]:not(:popover-open)` guard, which exists
 * because reka can render content into the native popover layer before it is
 * shown. We never use the popover API.
 */
import { onScopeDispose, watch, type Ref } from "vue";

/** How many live layers are hiding this element. */
const hideCount = new WeakMap<Element, number>();
/** Its `aria-hidden` before we first touched it (`null` = attribute absent). */
const originalAriaHidden = new WeakMap<Element, string | null>();

function shouldSkip(element: Element): boolean {
  return (
    element.tagName === "SCRIPT" || element.tagName === "STYLE" || element.hasAttribute("aria-live")
  );
}

function hideOthers(target: Element): () => void {
  const hidden: Element[] = [];
  let node: Element | null = target;
  while (node && node !== document.body.parentElement) {
    const parent: Element | null = node.parentElement;
    if (!parent) break;
    for (const sibling of parent.children) {
      if (sibling === node || shouldSkip(sibling)) continue;
      const count = hideCount.get(sibling) ?? 0;
      if (count === 0) {
        originalAriaHidden.set(sibling, sibling.getAttribute("aria-hidden"));
        sibling.setAttribute("aria-hidden", "true");
      }
      hideCount.set(sibling, count + 1);
      hidden.push(sibling);
    }
    node = parent;
  }

  return () => {
    for (const element of hidden) {
      const count = (hideCount.get(element) ?? 1) - 1;
      if (count > 0) {
        hideCount.set(element, count);
        continue;
      }
      hideCount.delete(element);
      const original = originalAriaHidden.get(element) ?? null;
      originalAriaHidden.delete(element);
      if (original === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", original);
    }
    hidden.length = 0;
  };
}

/** Hide everything outside `target` while it is in the DOM. */
export function useHideOthers(target: Ref<HTMLElement | null | undefined>): void {
  if (import.meta.server) return;

  let undo: (() => void) | undefined;
  watch(
    target,
    (element) => {
      undo?.();
      undo = element ? hideOthers(element) : undefined;
    },
    { immediate: true, flush: "post" },
  );

  onScopeDispose(() => {
    undo?.();
    undo = undefined;
  });
}
