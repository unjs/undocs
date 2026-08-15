import { describe, expect, it } from "vitest";
import { Comment, Fragment, Text, h } from "vue";
import { singleChild } from "@app/components/ui/primitives/AsChild.ts";
import {
  splitPlacement,
  transformOriginMiddleware,
  type TransformOrigin,
} from "@app/components/ui/primitives/usePopper.ts";

/**
 * The popper layer (ported from reka-ui, see `usePopper.ts`) is mostly geometry
 * against a live layout, which vitest's `node` environment cannot provide —
 * flipping, shifting and collision detection are exercised in a real browser.
 * Two pieces are pure, and both are places a silent regression would hide:
 * `transformOrigin` (a wrong origin makes a tooltip zoom out of the wrong
 * corner, which reads as a glitch rather than a bug) and `AsChild`'s slot
 * unwrap (a missed vnode silently drops every trigger handler, and the tooltip
 * simply never opens).
 */
function origin(placement: string, floating = { width: 80, height: 30 }): TransformOrigin {
  const middleware = transformOriginMiddleware();
  const result = middleware.fn({
    placement,
    rects: { floating, reference: { width: 40, height: 40, x: 0, y: 0 } },
  } as never) as { data: TransformOrigin };
  return result.data;
}

describe("splitPlacement", () => {
  it("defaults a bare side to centre alignment", () => {
    expect(splitPlacement("top")).toEqual(["top", "center"]);
  });

  it("splits an aligned placement", () => {
    expect(splitPlacement("bottom-start")).toEqual(["bottom", "start"]);
    expect(splitPlacement("left-end")).toEqual(["left", "end"]);
  });
});

describe("transformOrigin", () => {
  it("grows from the edge that faces the anchor", () => {
    // The anchor is BELOW a tooltip placed on top, so the origin sits on the
    // content's bottom edge — which is its own height, in px.
    expect(origin("top")).toEqual({ x: "50%", y: "30px" });
    expect(origin("bottom")).toEqual({ x: "50%", y: "0px" });
    expect(origin("left")).toEqual({ x: "80px", y: "50%" });
    expect(origin("right")).toEqual({ x: "0px", y: "50%" });
  });

  it("follows the alignment along that edge", () => {
    expect(origin("bottom-start")).toEqual({ x: "0%", y: "0px" });
    expect(origin("bottom-end")).toEqual({ x: "100%", y: "0px" });
    expect(origin("right-start")).toEqual({ x: "0px", y: "0%" });
    expect(origin("right-end")).toEqual({ x: "0px", y: "100%" });
  });
});

describe("AsChild slot unwrap", () => {
  it("finds the element through the fragment `<slot/>` compiles to", () => {
    const child = h("a", { href: "/x" });
    expect(singleChild([h(Fragment, null, [child])])).toBe(child);
  });

  it("recurses through a slot forwarded into another slot", () => {
    const child = h("span");
    expect(singleChild([h(Fragment, null, [h(Fragment, null, [child])])])).toBe(child);
  });

  it("ignores the comment a switched-off `v-if` leaves behind", () => {
    const child = h("button");
    expect(singleChild([h(Comment), child, h(Comment)])).toBe(child);
  });

  it("ignores the whitespace text nodes template indentation produces", () => {
    const child = h("button");
    expect(singleChild([h(Text, null, "\n  "), child, h(Text, null, " ")])).toBe(child);
  });

  it("gives up on an ambiguous slot rather than guessing", () => {
    expect(singleChild([])).toBeUndefined();
    expect(singleChild([h(Comment)])).toBeUndefined();
    expect(singleChild([h("a"), h("b")])).toBeUndefined();
  });
});
