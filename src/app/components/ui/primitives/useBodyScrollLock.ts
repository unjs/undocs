/**
 * useBodyScrollLock — freeze the page behind a modal layer without moving it.
 *
 * Ported from reka-ui's `useBodyScrollLock` (MIT,
 * https://github.com/unovue/reka-ui), running with the `scrollBody: true`
 * behaviour its `ConfigProvider` defaulted to (step 1 removed that provider; the
 * default it supplied is now stated here, which is the only place that ever read
 * it).
 *
 * The naive version of this is `document.body.style.overflow = "hidden"`, and it
 * is wrong in a way that is very visible: on a platform with classic (space
 * -taking) scrollbars, hiding the overflow reclaims the scrollbar's ~15px and
 * every centred element on the page — the header's `Container`, the docs
 * content — jumps sideways, then jumps back on close. So the width the
 * scrollbar was occupying is measured (`innerWidth - clientWidth`) and handed
 * back to the body as padding before the overflow is hidden. On platforms with
 * overlay scrollbars that difference is 0 and nothing is added, which is also
 * correct. `--scrollbar-width` is published on `<html>` for CSS that needs the
 * same number (`position: fixed` children do not inherit the body's padding).
 *
 * Two more pieces that are easy to miss and are ported as-is:
 *
 * - iOS Safari ignores `overflow: hidden` on `<body>` — the page rubber-bands
 *   under the modal anyway. The only fix is to `preventDefault()` `touchmove`,
 *   but only for touches that are NOT inside a scrollable subtree, or the
 *   modal's own scroll area (both dialogs have one) stops working. Hence
 *   `isTouchInsideScrollable`.
 * - `pointer-events: none` on the body one tick later, so the frozen page is
 *   also non-interactive. It has to be deferred: applied synchronously it would
 *   land on the body while the pointerdown that opened the layer is still being
 *   dispatched.
 *
 * Locks are refcounted through a module-level set of tokens, because two layers
 * can hold the lock at once (a menu inside a dialog) and the LAST one to release
 * must be the one that restores the body. The set is only ever touched from
 * browser code paths — every entry point below returns early under
 * `import.meta.server` — so it is not the per-request mutable state the
 * concurrency invariant in AGENTS.md forbids: on the server it stays empty.
 *
 * Dropped from reka: the `scrollBody` object form (`{ padding, margin }`), which
 * only exists so an app can compensate a fixed sidebar it positioned itself, and
 * the `createSharedComposable` wrapper — a plain module-level set is the same
 * thing without the effect-scope bookkeeping.
 */
import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from "vue";

/** The body styles a lock applies, given the measured scrollbar width. */
export interface ScrollLockStyles {
  paddingRight: string;
  marginRight: string;
}

/**
 * Pure so the compensation maths can be tested without a DOM. reka pads by the
 * scrollbar width and leaves the margin at 0 under `scrollBody: true`; a
 * viewport with no space-taking scrollbar gets neither, and — as in reka — is
 * not restyled at all beyond the deferred `overflow`/`pointer-events`.
 */
export function scrollLockStyles(scrollbarWidth: number): ScrollLockStyles {
  return { paddingRight: `${scrollbarWidth}px`, marginRight: "0px" };
}

const locks = new Set<symbol>();

/** `body.style.overflow` as it was before the first lock, to restore verbatim. */
let initialOverflow: string | undefined;
let stopTouchMove: (() => void) | undefined;

function isIOS(): boolean {
  // `platform` is deprecated but still the only reliable iPad-on-iPadOS tell,
  // which reports itself as "MacIntel" and is separated out by touch points.
  const platform = navigator.platform || "";
  return (
    /iP(?:ad|hone|od)/.test(platform) || (platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Walk up from the touch target looking for something that can actually scroll. */
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
  // Pinch-zoom is two fingers; leave it alone.
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

  // Deferred: see the note above about the pointerdown still in flight.
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

/**
 * Hold the body scroll lock for as long as `active` is true. The lock is
 * released on scope disposal too, so a layer that is torn down mid-animation
 * cannot leave the page frozen.
 */
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
    // `flush: "sync"` mirrors reka: the lock must be in place in the same tick
    // the layer appears, or the page scrolls one frame before it freezes.
    { immediate: true, flush: "sync" },
  );

  onScopeDispose(release);
}
