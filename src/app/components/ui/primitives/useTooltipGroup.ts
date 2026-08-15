/**
 * useTooltipGroup — the shared "warm up once, then be instant" tooltip timer.
 *
 * Ported from reka-ui's `TooltipProvider` (MIT,
 * https://github.com/unovue/reka-ui). It is the one piece of a tooltip that
 * cannot live in the tooltip: the delay is a property of the GROUP, not of any
 * single label. A row of icon buttons should make you wait once, and then
 * answer immediately as you sweep across the rest of them — and go back to
 * waiting a short while after you leave, so the row does not stay armed forever.
 * Two timers do that:
 *
 * - `delayDuration` (each tooltip's own): how long a hover must persist before a
 *   COLD group opens. During it, nothing is shown.
 * - `skipDelayDuration` (the group's): how long after the last tooltip closed
 *   the group stays WARM. Move to a sibling inside that window and it opens on
 *   the first `pointermove`; wait it out and the delay is back.
 *
 * `isOpenDelayed` is the group's temperature, and the reason this is
 * `provide`/`inject` rather than a module-level ref. reka's is per-provider too,
 * and it has to be: a module-level ref is shared by every concurrent SSR render
 * in the process, which is exactly what AGENTS.md's per-request-state invariant
 * forbids. Here the state is created inside `provideTooltipGroup()`, i.e. inside
 * one component's `setup()`, so it belongs to one render.
 *
 * Differences from reka:
 *
 * - `disableHoverableContent`, `disableClosingTrigger`, `ignoreNonKeyboardFocus`
 *   and the group-wide `content` prop-defaults object are dropped: no call site
 *   passes any of them, and each only selects a non-default branch. (Hoverable
 *   content is dropped outright — see `Tooltip.vue`.)
 * - reka broadcasts a `tooltip.open` `CustomEvent` on `document` so an opening
 *   tooltip closes every other one; that never worked, because the event is
 *   non-bubbling and every listener is registered on `window`, which is not the
 *   target. The intent was right, so it is implemented here directly: the group
 *   remembers the open tooltip's close callback and calls it when another opens.
 *   It only bites in the mixed case (one tooltip held open by keyboard focus
 *   while the pointer hovers another), which is why nobody noticed.
 * - The group-level `disabled` flag is dropped; `Tooltip`'s per-instance
 *   `disabled` prop is the one every call site actually uses.
 */
import { computed, inject, provide, toValue, type InjectionKey, type MaybeRefOrGetter } from "vue";

export interface TooltipGroupContext {
  /** True while the group is cold — the next tooltip must wait out its delay. */
  isOpenDelayed: () => boolean;
  /** The group's default hover delay, in ms. */
  delayDuration: () => number;
  /** Announce that a tooltip opened. `close` closes it again. */
  onOpen: (close: () => void) => void;
  /** Announce that a tooltip closed; starts the skip-delay grace period. */
  onClose: (close: () => void) => void;
}

export interface TooltipGroupOptions {
  /** Default hover delay for tooltips in this group. Default `700`. */
  delayDuration?: MaybeRefOrGetter<number>;
  /** How long the group stays warm after the last close. Default `300`. */
  skipDelayDuration?: MaybeRefOrGetter<number>;
}

const TOOLTIP_GROUP = Symbol("undocs-tooltip-group") as InjectionKey<TooltipGroupContext>;

export function createTooltipGroup(options: TooltipGroupOptions = {}): TooltipGroupContext {
  // Not a `ref`: nothing renders from the group's temperature — it is read
  // imperatively at the moment a trigger is entered — so a plain closure
  // variable keeps it out of the reactivity graph entirely.
  let isOpenDelayed = true;
  let warmTimer: ReturnType<typeof setTimeout> | undefined;
  let activeClose: (() => void) | undefined;

  const delayDuration = computed(() => toValue(options.delayDuration) ?? 700);
  const skipDelayDuration = computed(() => toValue(options.skipDelayDuration) ?? 300);

  return {
    isOpenDelayed: () => isOpenDelayed,
    delayDuration: () => delayDuration.value,
    onOpen(close) {
      clearTimeout(warmTimer);
      isOpenDelayed = false;
      if (activeClose && activeClose !== close) activeClose();
      activeClose = close;
    },
    onClose(close) {
      if (activeClose === close) activeClose = undefined;
      clearTimeout(warmTimer);
      warmTimer = setTimeout(() => {
        isOpenDelayed = true;
      }, skipDelayDuration.value);
    },
  };
}

/** Make one group for everything below this component. */
export function provideTooltipGroup(options: TooltipGroupOptions = {}): TooltipGroupContext {
  const context = createTooltipGroup(options);
  provide(TOOLTIP_GROUP, context);
  return context;
}

/**
 * The enclosing group. A tooltip mounted outside any provider gets a group of
 * its own — it simply never shares the warm window — rather than the runtime
 * error reka raises. There is nothing a docs page can do about a missing
 * provider, and a tooltip that still works alone is the better failure.
 */
export function useTooltipGroup(): TooltipGroupContext {
  const context = inject(TOOLTIP_GROUP, undefined);
  return context ?? createTooltipGroup();
}
