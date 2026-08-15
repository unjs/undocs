import { describe, it, expect } from "vitest";
import {
  BREAKPOINTS,
  gridLine,
  guideLayers,
  resolveResponsive,
  responsiveVars,
} from "../../src/app/components/grid/responsive.ts";

/**
 * The Geist grid's breakpoint layer (`src/app/components/grid/responsive.ts`).
 *
 * Everything here exists because the grid resolves breakpoints in JS and lets
 * CSS pick, rather than measuring the viewport. That trade buys hydration
 * parity and costs a small pile of invariants that fail SILENTLY when broken:
 * a dropped `grid-column` renders as auto placement, a guide overlay that no
 * media query shows renders as a grid with no rules, and both look like a
 * styling choice rather than a bug.
 */

describe("resolveResponsive", () => {
  it("spreads a bare value across every breakpoint", () => {
    expect(resolveResponsive(3, 1)).toEqual({ sm: 3, md: 3, lg: 3 });
  });

  it("falls back when nothing is given", () => {
    expect(resolveResponsive(undefined, 1)).toEqual({ sm: 1, md: 1, lg: 1 });
  });

  /**
   * The cascade is the whole point: an unset breakpoint inherits the one BELOW
   * it, not the default. `{ sm: 1, lg: 3 }` has to mean "one column until lg",
   * which is what the equivalent hand-written `lg:` utility would do. Falling
   * back to the default at `md` would silently reset the middle breakpoint.
   */
  it("cascades unset breakpoints upward rather than to the fallback", () => {
    expect(resolveResponsive({ sm: 1, lg: 3 }, 9)).toEqual({ sm: 1, md: 1, lg: 3 });
    expect(resolveResponsive({ md: 2 }, 9)).toEqual({ sm: 9, md: 2, lg: 2 });
    expect(resolveResponsive({ lg: 4 }, 9)).toEqual({ sm: 9, md: 9, lg: 4 });
  });

  it("keeps a zero rather than treating it as unset", () => {
    expect(resolveResponsive({ sm: 0, lg: 2 }, 1)).toEqual({ sm: 0, md: 0, lg: 2 });
  });
});

describe("responsiveVars", () => {
  it("emits the triple the scoped styles read", () => {
    expect(responsiveVars("cols", { sm: 1, md: 2, lg: 3 })).toEqual({
      "--ug-cols-sm": "1",
      "--ug-cols-md": "2",
      "--ug-cols-lg": "3",
    });
  });

  it("covers every breakpoint the component styles query", () => {
    const vars = Object.keys(responsiveVars("cols", { sm: 1, md: 1, lg: 1 }));
    for (const bp of BREAKPOINTS) {
      expect(vars).toContain(`--ug-cols-${bp}`);
    }
  });
});

describe("gridLine", () => {
  /**
   * These values land in a custom property, and custom properties substitute as
   * a raw TOKEN STREAM. CSS tokenizes `/-1` as a delim plus a number only if
   * the slash is separated; unseparated, `grid-column: 1/-1` via `var()` is
   * dropped at computed-value time and the cell silently reverts to auto
   * placement. So the spacing is load-bearing, not cosmetic.
   */
  it("spaces the slash so a negative end line survives substitution", () => {
    expect(gridLine("1/-1")).toBe("1 / -1");
    expect(gridLine("1/3")).toBe("1 / 3");
  });

  it("normalizes whitespace already present", () => {
    expect(gridLine(" 2  /  4 ")).toBe("2 / 4");
  });

  it("passes a bare line number through", () => {
    expect(gridLine(2)).toBe("2");
  });

  it("maps nothing to auto placement", () => {
    expect(gridLine(undefined)).toBe("auto");
    expect(gridLine("")).toBe("auto");
  });
});

describe("guideLayers", () => {
  const flat = (n: number) => ({ sm: n, md: n, lg: n });

  it("collapses a non-responsive grid to a single overlay", () => {
    const layers = guideLayers(flat(3), flat(2));
    expect(layers).toHaveLength(1);
    expect(layers[0]!.classes).toEqual(["ug-guides--sm", "ug-guides--md", "ug-guides--lg"]);
    // Interior rules only — the frame is the grid's own border.
    expect(layers[0]).toMatchObject({ vLines: 2, hLines: 1 });
  });

  it("emits one overlay per distinct shape", () => {
    const layers = guideLayers({ sm: 1, md: 2, lg: 3 }, { sm: 6, md: 3, lg: 2 });
    expect(layers.map((l) => [l.vLines, l.hLines])).toEqual([
      [0, 5],
      [1, 2],
      [2, 1],
    ]);
  });

  /**
   * Each media query hides the breakpoint below it and shows its own, so a
   * shared overlay only works for ADJACENT breakpoints. Merging `sm` with `lg`
   * across a differing `md` would produce an overlay the `md` rule hides and no
   * later rule brings back — the grid would lose its rules at one width only.
   */
  it("does not merge equal shapes across a differing breakpoint", () => {
    const layers = guideLayers({ sm: 1, md: 2, lg: 1 }, flat(2));
    expect(layers).toHaveLength(3);
    expect(layers.map((l) => l.classes)).toEqual([
      ["ug-guides--sm"],
      ["ug-guides--md"],
      ["ug-guides--lg"],
    ]);
  });

  it("every breakpoint is shown by exactly one overlay", () => {
    for (const columns of [flat(1), { sm: 1, md: 2, lg: 3 }, { sm: 2, md: 1, lg: 2 }]) {
      const layers = guideLayers(columns, flat(2));
      for (const bp of BREAKPOINTS) {
        const owners = layers.filter((l) => l.classes.includes(`ug-guides--${bp}`));
        expect(owners, `${bp} of ${JSON.stringify(columns)}`).toHaveLength(1);
      }
    }
  });

  it("drops one axis without disturbing the other", () => {
    expect(guideLayers(flat(4), flat(3), "row")[0]).toMatchObject({ vLines: 3, hLines: 0 });
    expect(guideLayers(flat(4), flat(3), "column")[0]).toMatchObject({ vLines: 0, hLines: 2 });
  });

  it("never asks for a negative number of rules", () => {
    expect(guideLayers(flat(1), flat(1))[0]).toMatchObject({ vLines: 0, hLines: 0 });
    expect(guideLayers(flat(0), flat(0))[0]).toMatchObject({ vLines: 0, hLines: 0 });
  });
});
