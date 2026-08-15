import { describe, expect, it } from "vitest";
import {
  PRESENCE_MACHINE,
  isPresentState,
  presenceTransition,
  type PresenceEvent,
  type PresenceState,
} from "@app/components/ui/primitives/usePresence.ts";

/**
 * The presence state machine (ported from reka-ui, see `usePresence.ts`) decides
 * when a closing dialog/tooltip/menu is allowed to leave the DOM. The DOM half —
 * computed-style reads and animation events — needs a browser and vitest runs in
 * the `node` environment, so what is pinned here is the transition table, which
 * is where the two failure modes actually live: unmount too early and the exit
 * animation never plays, unmount never and the layer keeps holding focus, the
 * body scroll lock and every outside click.
 */
const ALL_STATES: PresenceState[] = ["mounted", "unmountSuspended", "unmounted"];
const ALL_EVENTS: PresenceEvent[] = ["MOUNT", "UNMOUNT", "ANIMATION_OUT", "ANIMATION_END"];

describe("presence state machine", () => {
  it("suspends the unmount for the exit animation, then completes it", () => {
    const suspended = presenceTransition("mounted", "ANIMATION_OUT");
    expect(suspended).toBe("unmountSuspended");
    expect(isPresentState(suspended)).toBe(true); // still rendered — that's the point
    expect(presenceTransition(suspended, "ANIMATION_END")).toBe("unmounted");
  });

  it("unmounts immediately when there is nothing to animate", () => {
    expect(presenceTransition("mounted", "UNMOUNT")).toBe("unmounted");
  });

  it("re-opening mid-exit returns to mounted without ever unmounting", () => {
    expect(presenceTransition("unmountSuspended", "MOUNT")).toBe("mounted");
  });

  it("ignores the END of an ENTER animation", () => {
    // `animationend` fires for the open animation too. If that unmounted the
    // node, every dialog would vanish ~150ms after opening.
    expect(presenceTransition("mounted", "ANIMATION_END")).toBe("mounted");
  });

  it("ignores an exit animation that starts while already unmounted", () => {
    expect(presenceTransition("unmounted", "ANIMATION_OUT")).toBe("unmounted");
    expect(presenceTransition("unmounted", "ANIMATION_END")).toBe("unmounted");
    expect(presenceTransition("unmounted", "UNMOUNT")).toBe("unmounted");
  });

  it("only ever transitions to a known state, and unknown events are no-ops", () => {
    for (const state of ALL_STATES) {
      for (const event of ALL_EVENTS) {
        const next = presenceTransition(state, event);
        expect(ALL_STATES).toContain(next);
        if (!(event in PRESENCE_MACHINE[state])) expect(next).toBe(state);
      }
    }
  });

  it("renders in exactly the two states that keep the node in the DOM", () => {
    expect(ALL_STATES.filter((state) => isPresentState(state))).toEqual([
      "mounted",
      "unmountSuspended",
    ]);
  });
});
