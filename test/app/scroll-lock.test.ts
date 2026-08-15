import { describe, expect, it } from "vitest";
import { scrollLockStyles } from "@app/components/ui/primitives/useBodyScrollLock.ts";

/**
 * The scrollbar-width compensation from `useBodyScrollLock` (ported from
 * reka-ui). Hiding the body overflow reclaims the space a classic scrollbar was
 * occupying, and everything centred on the page — the header's `Container`,
 * the docs column — shifts sideways unless exactly that width is handed
 * back as padding. The maths is trivial and the bug it prevents is not, so it is
 * pinned here; the DOM application around it needs a browser.
 */
describe("scrollLockStyles", () => {
  it("gives back exactly the width the scrollbar was taking", () => {
    expect(scrollLockStyles(15)).toEqual({ paddingRight: "15px", marginRight: "0px" });
    expect(scrollLockStyles(17)).toEqual({ paddingRight: "17px", marginRight: "0px" });
  });

  it("compensates nothing for overlay scrollbars", () => {
    // macOS/mobile overlay scrollbars measure 0 — `innerWidth === clientWidth` —
    // and padding the body there would introduce the shift instead of removing
    // it. (The caller skips the restyle entirely at 0; the formula agrees.)
    expect(scrollLockStyles(0)).toEqual({ paddingRight: "0px", marginRight: "0px" });
  });

  it("never uses the margin under reka's `scrollBody: true` default", () => {
    // reka's object form of `scrollBody` can move the compensation to the margin
    // (for apps positioning their own fixed rail); we ship the boolean default,
    // so the margin is always reset rather than left at whatever it was.
    for (const width of [0, 1, 15, 100]) {
      expect(scrollLockStyles(width).marginRight).toBe("0px");
    }
  });
});
