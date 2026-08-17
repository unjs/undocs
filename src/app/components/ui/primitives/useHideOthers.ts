/**
 * Ported from reka-ui's `useHideOthers` (MIT,
 * https://github.com/unovue/reka-ui), which delegates to `aria-hidden`. It hides
 * siblings along the target-to-body chain while preserving `aria-live` regions;
 * a focus trap alone cannot constrain screen-reader virtual navigation.
 * Per-element refcounts and original values keep overlapping layers from
 * unhiding each other's content. WeakMaps are browser-only; SSR returns before
 * writes.
 *
 * Dropped, and why:
 * - `[popover]:not(:popover-open)` handling: undocs never uses native popovers.
 */
import { onScopeDispose, watch, type Ref } from "vue";

const hideCount = new WeakMap<Element, number>();
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
