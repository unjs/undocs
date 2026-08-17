/**
 * Ported from reka-ui's `useBodyScrollLock` (MIT,
 * https://github.com/unovue/reka-ui) with its `scrollBody: true` default.
 * Space-taking scrollbars are replaced with body padding and published as
 * `--scrollbar-width`; iOS touchmove is blocked only outside scrollable content
 * and never for pinch zoom. Body pointer events are disabled one tick later so
 * the opening pointerdown can finish. Locks are refcounted in a browser-only
 * module set; SSR returns before writing it.
 *
 * Dropped, and why:
 * - `scrollBody`'s `{ padding, margin }` form: undocs has no fixed app-owned
 *   sidebar requiring custom compensation.
 * - `createSharedComposable`: the browser-only token set provides the same
 *   refcounting without effect-scope bookkeeping.
 */
import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from "vue";

export interface ScrollLockStyles {
  paddingRight: string;
  marginRight: string;
}

/** reka's `scrollBody: true` compensation, exported for DOM-free tests. */
export function scrollLockStyles(scrollbarWidth: number): ScrollLockStyles {
  return { paddingRight: `${scrollbarWidth}px`, marginRight: "0px" };
}

const locks = new Set<symbol>();

let initialOverflow: string | undefined;
let stopTouchMove: (() => void) | undefined;

function isIOS(): boolean {
  // iPadOS reports `MacIntel`; touch points distinguish it from macOS.
  const platform = navigator.platform || "";
  return (
    /iP(?:ad|hone|od)/.test(platform) || (platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isTouchInsideScrollable(node: Element | null): boolean {
  while (node && node.tagName !== "BODY") {
    const style = window.getComputedStyle(node);
    if (
      style.overflowX === "scroll" ||
      style.overflowY === "scroll" ||
      (style.overflowX === "auto" && node.clientWidth < node.scrollWidth) ||
      (style.overflowY === "auto" && node.clientHeight < node.scrollHeight)
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

function onTouchMove(event: TouchEvent) {
  const target = event.target;
  if (target instanceof Element && isTouchInsideScrollable(target)) return;
  // Preserve pinch zoom.
  if (event.touches.length > 1) return;
  if (event.cancelable) event.preventDefault();
}

function applyLock() {
  if (initialOverflow === undefined) initialOverflow = document.body.style.overflow;

  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  if (scrollbarWidth > 0) {
    const styles = scrollLockStyles(scrollbarWidth);
    document.body.style.paddingRight = styles.paddingRight;
    document.body.style.marginRight = styles.marginRight;
    document.documentElement.style.setProperty("--scrollbar-width", `${scrollbarWidth}px`);
    document.body.style.overflow = "hidden";
  }

  if (isIOS() && !stopTouchMove) {
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    stopTouchMove = () => document.removeEventListener("touchmove", onTouchMove);
  }

  // Let the opening pointerdown finish before making the body inert.
  setTimeout(() => {
    if (locks.size === 0) return;
    document.body.style.pointerEvents = "none";
    document.body.style.overflow = "hidden";
  });
}

function releaseLock() {
  document.body.style.paddingRight = "";
  document.body.style.marginRight = "";
  document.body.style.pointerEvents = "";
  document.documentElement.style.removeProperty("--scrollbar-width");
  document.body.style.overflow = initialOverflow ?? "";
  stopTouchMove?.();
  stopTouchMove = undefined;
  initialOverflow = undefined;
}

/** Scope disposal also releases an active lock. */
export function useBodyScrollLock(active: MaybeRefOrGetter<boolean>): void {
  if (import.meta.server) return;

  const token = Symbol("undocs-scroll-lock");

  const release = () => {
    if (!locks.delete(token)) return;
    if (locks.size === 0) releaseLock();
  };

  watch(
    () => toValue(active),
    (value) => {
      if (value) {
        if (locks.has(token)) return;
        const wasLocked = locks.size > 0;
        locks.add(token);
        if (!wasLocked) applyLock();
      } else {
        release();
      }
    },
    // Lock in the layer's opening tick to prevent one frame of page scrolling.
    { immediate: true, flush: "sync" },
  );

  onScopeDispose(release);
}
