/**
 * usePresence — keep an element mounted until its exit animation has finished.
 *
 * Ported from reka-ui's `Presence`/`usePresence` (MIT,
 * https://github.com/unovue/reka-ui), which is itself a port of Radix's. Every
 * `data-[state=closed]:animate-out` / `fade-out-0` / `zoom-out-95` class in this
 * codebase is dead without it: `v-if="open"` rips the node out of the DOM in the
 * same tick the class that would animate it appears, so the exit keyframes never
 * get a frame to run in. This composable inverts that — the node stays mounted
 * while `data-state="closed"` plays, and is removed on `animationend`.
 *
 * The reason it reads COMPUTED STYLES rather than counting down a timeout (the
 * obvious shortcut) is that neither end of the animation is knowable up front:
 * there is no `animationrun` event, and `animationstart` only fires after
 * `animation-delay` has elapsed — too late to tell "an exit animation started"
 * from "there is no exit animation". So the state machine compares
 * `animation-name` before and after the state flip: a CHANGED name means new
 * keyframes were attached and we must wait for them; an unchanged name (or
 * `none`, or `display: none`) means there is nothing to wait for and the node
 * unmounts immediately. A fixed timeout would get both failure modes wrong —
 * too short and content vanishes mid-animation, too long and a non-animated
 * layer lingers (and, since the layer is still registered, keeps swallowing
 * clicks and holding the body scroll lock).
 *
 * Differences from reka, all deliberate:
 *
 * - reka ships this as a `<Presence>` COMPONENT that clones its single child
 *   vnode to steal an element ref, and throws at runtime if it is handed more
 *   than one child or a text node. We only ever need it from inside our own
 *   components, where a plain `ref="el"` on the element is right there — so it
 *   is a composable, and the fragile vnode surgery (plus its
 *   `data-reka-popper-content-wrapper` special case, which existed for reka's
 *   Popper) is gone.
 * - The four custom DOM events reka dispatches on the node
 *   (`enter`/`after-enter`/`leave`/`after-leave`) are dropped. They are a public
 *   escape hatch for reka's consumers; nothing here listens for them, and
 *   dispatching events nobody handles on every open/close is pure cost.
 * - `forceMount` is dropped — it is reka's hook for rendering hidden content up
 *   front (SEO, measurement). Neither dialog wants that, and the `unmountOnHide`
 *   knob it pairs with was never passed by our call sites either.
 *
 * The transition table itself is exported as a pure function so it can be tested
 * without a DOM (see `test/app/presence.test.ts`); vitest runs in the `node`
 * environment, so the animation plumbing below is only ever exercised in a real
 * browser.
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

/**
 * The state machine, verbatim from reka. `unmountSuspended` is the interesting
 * one: `present` is already false but the node is still on screen playing its
 * exit keyframes. A `MOUNT` arriving in that state (re-open mid-exit) goes
 * straight back to `mounted` without ever unmounting, so the node — and the
 * focus/scroll-lock state hanging off it — survives a fast toggle.
 */
export const PRESENCE_MACHINE: Record<
  PresenceState,
  Partial<Record<PresenceEvent, PresenceState>>
> = {
  mounted: { UNMOUNT: "unmounted", ANIMATION_OUT: "unmountSuspended" },
  unmountSuspended: { MOUNT: "mounted", ANIMATION_END: "unmounted" },
  unmounted: { MOUNT: "mounted" },
};

/** Apply `event` to `state`; unknown transitions are a no-op (reka's reducer). */
export function presenceTransition(state: PresenceState, event: PresenceEvent): PresenceState {
  return PRESENCE_MACHINE[state][event] ?? state;
}

/** Whether a state still renders the node. */
export function isPresentState(state: PresenceState): boolean {
  return state === "mounted" || state === "unmountSuspended";
}

export interface UsePresenceReturn {
  /** True while the node must stay in the DOM — including the exit animation. */
  isPresent: ComputedRef<boolean>;
  /**
   * What to put in `v-if`. Includes `present` itself because the node has to be
   * rendered for one tick BEFORE the machine can look at its computed styles.
   */
  shouldRender: ComputedRef<boolean>;
}

function getAnimationName(node: HTMLElement | null | undefined): string {
  return node ? getComputedStyle(node).animationName || "none" : "none";
}

export function usePresence(
  present: MaybeRefOrGetter<boolean>,
  node: Ref<HTMLElement | null | undefined>,
): UsePresenceReturn {
  // On the server there are no animations and no computed styles, so presence
  // collapses to the raw flag. This also keeps the machine's initial state
  // (`present ? mounted : unmounted`) identical on both sides of the hydration
  // boundary — the client's FIRST render always matches what was serialized.
  if (import.meta.server) {
    const isPresent = computed(() => toValue(present));
    return { isPresent, shouldRender: isPresent };
  }

  const state = ref<PresenceState>(toValue(present) ? "mounted" : "unmounted");
  const dispatch = (event: PresenceEvent) => {
    state.value = presenceTransition(state.value, event);
  };

  // The live `CSSStyleDeclaration` of the node (getComputedStyle returns a view,
  // not a snapshot) — used only for the `display: none` check below.
  let styles: CSSStyleDeclaration | undefined;
  const prevAnimationName = ref("none");
  let fillModeTimer: number | undefined;

  watch(
    () => toValue(present),
    async (current, previous) => {
      if (current === previous) return;
      // Let the render that flips `data-state` land first — the whole method
      // depends on reading the animation-name the NEW state selects.
      await nextTick();
      const previousName = prevAnimationName.value;
      const currentName = getAnimationName(node.value);
      if (current) {
        dispatch("MOUNT");
      } else if (currentName === "none" || styles?.display === "none") {
        // Nothing to play — leave immediately.
        dispatch("UNMOUNT");
      } else if (previous && previousName !== currentName) {
        // A different set of keyframes is attached than the one that was
        // running: an exit animation has started. Hold the node.
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

  /**
   * Starting an exit animation while the enter one is still running fires
   * `animationcancel` for the enter animation AFTER we have already entered
   * `unmountSuspended` — so only the animation currently attached to the node
   * may end the wait. `CSS.escape` because `animationName` is matched against
   * the (possibly comma-joined) computed `animation-name` string.
   */
  const onAnimationEnd = (event: AnimationEvent) => {
    if (event.target !== node.value) return;
    const currentName = getAnimationName(node.value);
    if (currentName.includes(CSS.escape(event.animationName))) {
      dispatch("ANIMATION_END");
      if (!toValue(present) && node.value) {
        // Vue removes the node on the next patch, not on this event. Between the
        // two the element would snap back to its un-animated styles for a frame;
        // pinning `animation-fill-mode: forwards` holds the last keyframe until
        // then, and the timer restores whatever was there in the (rare) case the
        // node survives.
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
        // The node went away without an `animationend` (a parent unmounted, a
        // route changed). Settle the machine so it can be re-entered cleanly.
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
