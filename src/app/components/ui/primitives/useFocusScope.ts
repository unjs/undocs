/**
 * Ported from reka-ui's `FocusScope` (MIT, https://github.com/unovue/reka-ui).
 * It autofocuses on mount, traps focus through document events and removal
 * observation, and restores focus after teardown. Nested scopes pause through a
 * browser-only stack; SSR returns before writes. Candidate discovery retains
 * reka/Radix's TreeWalker approximation, with visibility checked at Tab edges.
 *
 * Dropped, and why:
 * - mount/unmount autofocus `CustomEvent`s: direct veto and restore-target
 *   callbacks express the same decisions without DOM events.
 * - shadow-root active-element traversal: undocs renders no shadow roots.
 * - separate `present`: the `usePresence`-controlled element ref is the single
 *   lifecycle signal.
 */
import { onScopeDispose, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue";

export interface FocusScopeOptions {
  trapped?: MaybeRefOrGetter<boolean>;
  loop?: MaybeRefOrGetter<boolean>;
  /** Defaults to the element focused at setup. */
  restoreFocus?: () => HTMLElement | null | undefined;
  onMountAutoFocus?: () => boolean | void;
}

interface FocusScopeEntry {
  paused: boolean;
}

const scopeStack: FocusScopeEntry[] = [];

function pushScope(scope: FocusScopeEntry) {
  const active = scopeStack[0];
  if (active && active !== scope) active.paused = true;
  removeScope(scope);
  scopeStack.unshift(scope);
}

function removeScope(scope: FocusScopeEntry) {
  const index = scopeStack.indexOf(scope);
  if (index !== -1) scopeStack.splice(index, 1);
}

function isSelectableInput(element: Element): element is HTMLInputElement {
  return element instanceof HTMLInputElement && "select" in element;
}

export function focus(element: HTMLElement | null | undefined, select = false) {
  if (!element?.focus) return;
  const previous = document.activeElement;
  element.focus({ preventScroll: true });
  if (element !== previous && select && isSelectableInput(element)) element.select();
}

export function focusFirst(candidates: HTMLElement[], select = false): boolean {
  const previous = document.activeElement;
  for (const candidate of candidates) {
    focus(candidate, select);
    if (document.activeElement !== previous) return true;
  }
  return false;
}

export function getTabbableCandidates(container: HTMLElement): HTMLElement[] {
  const nodes: HTMLElement[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      const element = node as HTMLElement & { disabled?: boolean; type?: string };
      const isHiddenInput = element.tagName === "INPUT" && element.type === "hidden";
      if (element.disabled || element.hidden || isHiddenInput) return NodeFilter.FILTER_SKIP;
      return element.tabIndex >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  while (walker.nextNode()) nodes.push(walker.currentNode as HTMLElement);
  return nodes;
}

function isHidden(node: HTMLElement | null, upTo: HTMLElement): boolean {
  if (node && getComputedStyle(node).visibility === "hidden") return true;
  while (node) {
    if (node === upTo) return false;
    if (getComputedStyle(node).display === "none") return true;
    node = node.parentElement;
  }
  return false;
}

function getTabbableEdges(
  container: HTMLElement,
): [HTMLElement | undefined, HTMLElement | undefined] {
  const candidates = getTabbableCandidates(container);
  const first = candidates.find((element) => !isHidden(element, container));
  const last = candidates.reverse().find((element) => !isHidden(element, container));
  return [first, last];
}

export function useFocusScope(
  element: Ref<HTMLElement | null | undefined>,
  options: FocusScopeOptions = {},
): { onKeydown: (event: KeyboardEvent) => void } {
  const scope: FocusScopeEntry = { paused: false };

  /* Intercept only Tab edges; preserve the browser's internal ordering. */
  const onKeydown = (event: KeyboardEvent) => {
    if (!toValue(options.loop ?? false) && !toValue(options.trapped ?? false)) return;
    if (scope.paused) return;
    const isTab = event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey;
    const focused = document.activeElement as HTMLElement | null;
    if (!isTab || !focused) return;

    const container = event.currentTarget as HTMLElement;
    const [first, last] = getTabbableEdges(container);
    if (!first || !last) {
      // Keep focus parked when a trapped scope has no tabbable child.
      if (focused === container) event.preventDefault();
      return;
    }
    if (!event.shiftKey && focused === last) {
      event.preventDefault();
      if (toValue(options.loop ?? false)) focus(first, true);
    } else if (event.shiftKey && focused === first) {
      event.preventDefault();
      if (toValue(options.loop ?? false)) focus(last, true);
    }
  };

  if (import.meta.server) return { onKeydown };

  // Last valid in-scope focus target.
  let lastFocusedInside: HTMLElement | null = null;

  watch(
    [element, () => toValue(options.trapped ?? false)],
    ([container, trapped], _previous, onCleanup) => {
      if (!container || !trapped) return;

      const onFocusIn = (event: FocusEvent) => {
        if (scope.paused) return;
        const target = event.target as HTMLElement | null;
        if (target && container.contains(target)) lastFocusedInside = target;
        else focus(lastFocusedInside, true);
      };

      const onFocusOut = (event: FocusEvent) => {
        if (scope.paused) return;
        const related = event.relatedTarget as HTMLElement | null;
        // Do not fight focus leaving the document (for example, devtools).
        if (related === null) return;
        if (!container.contains(related)) focus(lastFocusedInside, true);
      };

      // Rehome focus when dynamic content removes its focused node.
      const observer = new MutationObserver((mutations) => {
        if (!lastFocusedInside) return;
        if (!mutations.some((mutation) => mutation.removedNodes.length > 0)) return;
        if (!container.contains(lastFocusedInside)) focus(container);
      });

      document.addEventListener("focusin", onFocusIn);
      document.addEventListener("focusout", onFocusOut);
      observer.observe(container, { childList: true, subtree: true });

      onCleanup(() => {
        document.removeEventListener("focusin", onFocusIn);
        document.removeEventListener("focusout", onFocusOut);
        observer.disconnect();
      });
    },
    { immediate: true, flush: "post" },
  );

  watch(
    element,
    (container, _previous, onCleanup) => {
      if (!container) return;
      pushScope(scope);

      const previouslyFocused = document.activeElement as HTMLElement | null;
      lastFocusedInside = null;

      if (!container.contains(previouslyFocused) && options.onMountAutoFocus?.() !== false) {
        focusFirst(getTabbableCandidates(container), true);
        // The consumer's `tabindex="-1"` makes the empty container a fallback.
        if (document.activeElement === previouslyFocused) focus(container);
      }

      onCleanup(() => {
        const target = options.restoreFocus?.() ?? previouslyFocused ?? document.body;
        // Wait until the scope node is gone; focus on a soon-removed node is lost.
        setTimeout(() => {
          focus(target, true);
          removeScope(scope);
          // Resume the newly innermost trap only after focus restoration.
          if (scopeStack[0]) scopeStack[0].paused = false;
        });
      });
    },
    { immediate: true, flush: "post" },
  );

  onScopeDispose(() => removeScope(scope));

  return { onKeydown };
}
