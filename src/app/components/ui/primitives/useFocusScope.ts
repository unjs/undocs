/**
 * useFocusScope — a focus trap that also puts focus back where it came from.
 *
 * Ported from reka-ui's `FocusScope` (MIT, https://github.com/unovue/reka-ui).
 * Three jobs, and all three are what makes a modal a modal rather than a div
 * that happens to be on top:
 *
 * 1. On mount, move focus to the first tabbable child (the search input, the
 *    lightbox's close button) — or to the container itself if it has none, so
 *    the keyboard is never left pointing at the page underneath.
 * 2. While `trapped`, pull focus back in whenever it escapes. Tab wrapping alone
 *    is not enough: focus also moves by click, by programmatic `.focus()`, and
 *    by the browser's own recovery when the focused node is removed — hence the
 *    document-level `focusin`/`focusout` listeners AND the MutationObserver that
 *    re-homes focus when the element holding it is deleted from the scope.
 * 3. On teardown, restore focus to whatever had it before, on a 0ms timer so the
 *    restore happens after the node is actually gone (focusing an element that
 *    is about to be removed is a no-op the browser silently undoes).
 *
 * Nested scopes coordinate through a module-level stack: opening a scope PAUSES
 * the one below, so the outer trap does not fight the inner one for focus, and
 * closing resumes it. The stack is browser-only — the whole body of this
 * composable returns early under `import.meta.server`, and scopes are keyed to
 * DOM elements that do not exist during SSR — so it is not the per-request
 * mutable state AGENTS.md forbids.
 *
 * Differences from reka:
 *
 * - reka signals mount/unmount autofocus through cancellable `CustomEvent`s
 *   (`focusScope.autoFocusOnMount` / `…OnUnmount`) dispatched on the container,
 *   which is how its Dialog overrides the restore target. We take an
 *   `onMountAutoFocus` callback that returns `false` to opt out, and a
 *   `restoreFocus` getter that names the element to return to — the same two
 *   decisions, stated directly instead of through the DOM.
 * - reka's `getActiveElement` walks `shadowRoot.activeElement` chains. Nothing
 *   in undocs renders into a shadow root, so `document.activeElement` is used
 *   directly.
 * - The lifecycle keys off the element ref rather than a `present` prop, for the
 *   same reason as `useDismissableLayer`: `usePresence` already `v-if`s the
 *   element, so the ref is the single presence signal.
 *
 * `getTabbableCandidates` is the same TreeWalker approximation reka (and Radix,
 * and discord/focus-layers before it) uses. It is deliberately not a full
 * tabbability implementation — `findVisible` is what handles the cases a
 * property read cannot, and only for the two edges Tab actually needs.
 */
import { onScopeDispose, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue";

export interface FocusScopeOptions {
  /** Pull focus back into the scope when it leaves. */
  trapped?: MaybeRefOrGetter<boolean>;
  /** Wrap Tab/Shift+Tab around the scope's edges instead of leaving it. */
  loop?: MaybeRefOrGetter<boolean>;
  /**
   * Where focus goes when the scope tears down. Defaults to whatever was
   * focused when it was set up (for a dialog, the trigger that opened it).
   */
  restoreFocus?: () => HTMLElement | null | undefined;
  /** Return `false` to keep focus where it is when the scope mounts. */
  onMountAutoFocus?: () => boolean | void;
}

interface FocusScopeEntry {
  paused: boolean;
}

/** Innermost scope first. */
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

/** Focus without scrolling, selecting the contents of a text input we land on. */
export function focus(element: HTMLElement | null | undefined, select = false) {
  if (!element?.focus) return;
  const previous = document.activeElement;
  element.focus({ preventScroll: true });
  if (element !== previous && select && isSelectableInput(element)) element.select();
}

/** Focus the first candidate that actually takes focus; true if one did. */
export function focusFirst(candidates: HTMLElement[], select = false): boolean {
  const previous = document.activeElement;
  for (const candidate of candidates) {
    focus(candidate, select);
    if (document.activeElement !== previous) return true;
  }
  return false;
}

/** Every descendant that could plausibly be tabbed to, in DOM order. */
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

/** The first and last VISIBLE tabbable elements — the two Tab wraps between. */
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

  /**
   * Tab wrapping. Only ever preventDefault()s at the edges, so Tab inside the
   * scope keeps the browser's own ordering — including whatever the content
   * does with it (`DocsSearch`'s palette handles its own Arrow/Enter keys and
   * never sees Tab).
   */
  const onKeydown = (event: KeyboardEvent) => {
    if (!toValue(options.loop ?? false) && !toValue(options.trapped ?? false)) return;
    if (scope.paused) return;
    const isTab = event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey;
    const focused = document.activeElement as HTMLElement | null;
    if (!isTab || !focused) return;

    const container = event.currentTarget as HTMLElement;
    const [first, last] = getTabbableEdges(container);
    if (!first || !last) {
      // Nothing tabbable inside: swallow Tab so focus cannot walk out.
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

  // The element focus last legitimately sat on INSIDE the scope — the anchor the
  // trap drags focus back to.
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
        // `null` means focus left the document entirely (tab away, devtools) —
        // clawing it back would fight the browser.
        if (related === null) return;
        if (!container.contains(related)) focus(lastFocusedInside, true);
      };

      // Removing the focused node hands focus to <body>; put it back on the
      // container so the trap survives content that swaps itself out.
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
        // Nothing inside took it — park focus on the container itself, which is
        // why the consumer must render `tabindex="-1"` on it.
        if (document.activeElement === previouslyFocused) focus(container);
      }

      onCleanup(() => {
        const target = options.restoreFocus?.() ?? previouslyFocused ?? document.body;
        setTimeout(() => {
          focus(target, true);
          removeScope(scope);
          // Whatever is innermost now takes the trap back.
          if (scopeStack[0]) scopeStack[0].paused = false;
        });
      });
    },
    { immediate: true, flush: "post" },
  );

  onScopeDispose(() => removeScope(scope));

  return { onKeydown };
}
