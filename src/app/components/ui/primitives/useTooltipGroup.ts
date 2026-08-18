/**
 * Ported from reka-ui's `TooltipProvider` (MIT,
 * https://github.com/unovue/reka-ui). A provider-scoped cold delay and warm
 * skip-delay let sibling tooltips open instantly after the first. State belongs
 * to each component setup, never a concurrent-SSR module singleton. Opening one
 * tooltip directly closes the group's previous one.
 *
 * Dropped, and why:
 * - `disableHoverableContent`, `disableClosingTrigger`,
 *   `ignoreNonKeyboardFocus`, and group content defaults: no caller selects
 *   these non-default branches; hoverable content is not supported.
 * - reka's non-bubbling `tooltip.open` document event: its listeners were on
 *   window, so direct group callbacks implement the intended mutual exclusion.
 * - group `disabled`: callers use each tooltip's own flag.
 */
import { computed, inject, provide, toValue, type InjectionKey, type MaybeRefOrGetter } from "vue";

export interface TooltipGroupContext {
  isOpenDelayed: () => boolean;
  delayDuration: () => number;
  onOpen: (close: () => void) => void;
  onClose: (close: () => void) => void;
}

export interface TooltipGroupOptions {
  delayDuration?: MaybeRefOrGetter<number>;
  skipDelayDuration?: MaybeRefOrGetter<number>;
}

// A registry symbol, same reason as `router.ts`'s keys: provider and consumer can
// land in different chunks, and in dev a render can straddle two evaluations of
// this file. Here the inject is optional, so a mismatch only loses the shared
// group for a render rather than throwing — matching the others still costs
// nothing.
const TOOLTIP_GROUP = Symbol.for("undocs-tooltip-group") as InjectionKey<TooltipGroupContext>;

export function createTooltipGroup(options: TooltipGroupOptions = {}): TooltipGroupContext {
  // Temperature is read imperatively, so keep it outside the reactivity graph.
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

export function provideTooltipGroup(options: TooltipGroupOptions = {}): TooltipGroupContext {
  const context = createTooltipGroup(options);
  provide(TOOLTIP_GROUP, context);
  return context;
}

/* Without a provider, use an isolated working group instead of throwing. */
export function useTooltipGroup(): TooltipGroupContext {
  const context = inject(TOOLTIP_GROUP, undefined);
  return context ?? createTooltipGroup();
}
