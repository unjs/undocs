/**
 * Ported from reka-ui's Radix-derived `Presence`/`usePresence` (MIT,
 * https://github.com/unovue/reka-ui). It keeps closed nodes mounted through exit
 * keyframes. Computed `animation-name` changes distinguish a real exit from no
 * animation; fixed timers cannot handle CSS delay/duration or non-animated
 * layers safely. The pure transition table supports DOM-free tests.
 *
 * Dropped, and why:
 * - `<Presence>` vnode cloning, single-child errors, and reka's popper-wrapper
 *   special case: local components can bind an element ref directly.
 * - `enter`/`after-enter`/`leave`/`after-leave` DOM events: no caller listens.
 * - `forceMount` and paired `unmountOnHide`: no dialog pre-renders hidden content
 *   for SEO or measurement, and callers never select those branches.
 */
import {
  computed,
  nextTick,
  onScopeDispose,
  ref,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

export type PresenceState = "mounted" | "unmountSuspended" | "unmounted";

export type PresenceEvent = "MOUNT" | "UNMOUNT" | "ANIMATION_OUT" | "ANIMATION_END";

/* Reopening during `unmountSuspended` preserves the node and attached focus/
 * scroll-lock state. */
export const PRESENCE_MACHINE: Record<
  PresenceState,
  Partial<Record<PresenceEvent, PresenceState>>
> = {
  mounted: { UNMOUNT: "unmounted", ANIMATION_OUT: "unmountSuspended" },
  unmountSuspended: { MOUNT: "mounted", ANIMATION_END: "unmounted" },
  unmounted: { MOUNT: "mounted" },
};

export function presenceTransition(state: PresenceState, event: PresenceEvent): PresenceState {
  return PRESENCE_MACHINE[state][event] ?? state;
}

export function isPresentState(state: PresenceState): boolean {
  return state === "mounted" || state === "unmountSuspended";
}

export interface UsePresenceReturn {
  isPresent: ComputedRef<boolean>;
  /** Includes `present` so the node exists for one computed-style tick. */
  shouldRender: ComputedRef<boolean>;
}

function getAnimationName(node: HTMLElement | null | undefined): string {
  return node ? getComputedStyle(node).animationName || "none" : "none";
}

export function usePresence(
  present: MaybeRefOrGetter<boolean>,
  node: Ref<HTMLElement | null | undefined>,
): UsePresenceReturn {
  // SSR uses the raw flag so the client's first render has hydration parity.
  if (import.meta.server) {
    const isPresent = computed(() => toValue(present));
    return { isPresent, shouldRender: isPresent };
  }

  const state = ref<PresenceState>(toValue(present) ? "mounted" : "unmounted");
  const dispatch = (event: PresenceEvent) => {
    state.value = presenceTransition(state.value, event);
  };

  // `getComputedStyle` is a live view, used for the `display: none` check.
  let styles: CSSStyleDeclaration | undefined;
  const prevAnimationName = ref("none");
  let fillModeTimer: number | undefined;

  watch(
    () => toValue(present),
    async (current, previous) => {
      if (current === previous) return;
      // Read animation-name only after the new `data-state` has rendered.
      await nextTick();
      const previousName = prevAnimationName.value;
      const currentName = getAnimationName(node.value);
      if (current) {
        dispatch("MOUNT");
      } else if (currentName === "none" || styles?.display === "none") {
        dispatch("UNMOUNT");
      } else if (previous && previousName !== currentName) {
        // Changed keyframes signal an exit; keep the node mounted.
        dispatch("ANIMATION_OUT");
      } else {
        dispatch("UNMOUNT");
      }
    },
    { immediate: true },
  );

  const onAnimationStart = (event: AnimationEvent) => {
    if (event.target === node.value) prevAnimationName.value = getAnimationName(node.value);
  };

  /* An enter cancellation can arrive after exit starts; only an animation name
   * still attached to the node may end the wait. Escape names before matching
   * the possibly comma-joined computed value. */
  const onAnimationEnd = (event: AnimationEvent) => {
    if (event.target !== node.value) return;
    const currentName = getAnimationName(node.value);
    if (currentName.includes(CSS.escape(event.animationName))) {
      dispatch("ANIMATION_END");
      if (!toValue(present) && node.value) {
        // Hold the final keyframe until Vue's next patch removes the node.
        const element = node.value;
        const previousFillMode = element.style.animationFillMode;
        element.style.animationFillMode = "forwards";
        fillModeTimer = window.setTimeout(() => {
          if (node.value?.style.animationFillMode === "forwards") {
            node.value.style.animationFillMode = previousFillMode;
          }
        });
      }
    }
    if (currentName === "none") dispatch("ANIMATION_END");
  };

  const detach = (element: HTMLElement) => {
    element.removeEventListener("animationstart", onAnimationStart);
    element.removeEventListener("animationcancel", onAnimationEnd);
    element.removeEventListener("animationend", onAnimationEnd);
  };

  const stopNodeWatch = watch(
    node,
    (current, previous) => {
      if (current) {
        styles = getComputedStyle(current);
        current.addEventListener("animationstart", onAnimationStart);
        current.addEventListener("animationcancel", onAnimationEnd);
        current.addEventListener("animationend", onAnimationEnd);
      } else {
        // Settle when a parent removes the node without `animationend`.
        dispatch("ANIMATION_END");
        if (fillModeTimer !== undefined) clearTimeout(fillModeTimer);
        if (previous) detach(previous);
      }
    },
    { immediate: true },
  );

  const stopStateWatch = watch(state, () => {
    prevAnimationName.value = state.value === "mounted" ? getAnimationName(node.value) : "none";
  });

  onScopeDispose(() => {
    stopNodeWatch();
    stopStateWatch();
    if (node.value) detach(node.value);
    if (fillModeTimer !== undefined) clearTimeout(fillModeTimer);
  });

  const isPresent = computed(() => isPresentState(state.value));
  return { isPresent, shouldRender: computed(() => toValue(present) || isPresent.value) };
}
