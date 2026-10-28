import { describe, it, expect } from "vitest";
import {
  DEFAULT_COLOR_MODE,
  nextColorModePreference,
  type ColorModePreference,
  type ColorModeValue,
} from "../../src/app/color-mode.ts";

/** Follow the toggle from the default until it comes back round. */
function cycle(system: ColorModeValue): ColorModePreference[] {
  const seen: ColorModePreference[] = [DEFAULT_COLOR_MODE];
  for (let pref = nextColorModePreference(DEFAULT_COLOR_MODE, system); pref !== seen[0];) {
    seen.push(pref);
    pref = nextColorModePreference(pref, system);
  }
  return seen;
}

const shown = (pref: ColorModePreference, system: ColorModeValue) =>
  pref === "system" ? system : pref;

describe("nextColorModePreference", () => {
  it.each(["dark", "light"] as const)("visits every preference once on a %s OS", (system) => {
    expect(cycle(system).toSorted()).toEqual(["dark", "light", "system"]);
  });

  it.each(["dark", "light"] as const)(
    "changes the theme on every click except the one out of system (%s OS)",
    (system) => {
      for (const pref of ["dark", "light", "system"] as const) {
        const next = nextColorModePreference(pref, system);
        expect(shown(next, system) !== shown(pref, system)).toBe(pref !== "system");
      }
    },
  );

  it("leaves system for the mode already showing", () => {
    expect(nextColorModePreference("system", "dark")).toBe("dark");
    expect(nextColorModePreference("system", "light")).toBe("light");
  });

  it("orders the cycle by what the OS asks for", () => {
    expect(cycle("dark")).toEqual(["dark", "light", "system"]);
    expect(cycle("light")).toEqual(["dark", "system", "light"]);
  });
});
