/**
 * Color-mode contract — the plain constants shared by the two pieces of code
 * that resolve it, so they can never disagree:
 *
 *   * `inline/color-mode.ts` — the blocking `<head>` program that applies the
 *     class BEFORE the first paint (the SSR shell ships `class="dark"`, so
 *     without it a light-preference visitor gets a dark flash on every load);
 *   * `composables/useColorMode.ts` — the app-side driver that owns the
 *     reactive state, the toggle and persistence.
 *
 * Kept separate from the composable because the inline program must not pull in
 * Vue: everything it imports is bundled into the bytes on every HTML response.
 */

export type ColorModePreference = "light" | "dark" | "system";
export type ColorModeValue = "light" | "dark";

/** `localStorage` key holding the visitor's `ColorModePreference`. */
export const COLOR_MODE_STORAGE_KEY = "undocs-color-mode";

/**
 * Mode for a visitor who has never chosen one. MUST match the class on the SSR
 * shell's `<html>` (`entry-server.ts`) — that is what makes a first visit
 * flash-free without any client work.
 */
export const DEFAULT_COLOR_MODE: ColorModeValue = "dark";

/**
 * Attribute on `<html>` naming the visitor's PREFERENCE (the class names the
 * resolved mode). The inline program sets it before the first paint and the
 * composable keeps it current, so `ColorModeButton` can pick its glyph in CSS
 * and paint the right one before the app mounts. Absent means "never chose",
 * which shows the default's glyph.
 */
export const COLOR_MODE_ATTRIBUTE = "data-color-preference";

/** Narrows an untrusted string (e.g. a stored value) to a `ColorModePreference`. */
export function isColorModePreference(value: unknown): value is ColorModePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * The preference one click of the toggle moves to, given what the OS asks for.
 *
 * Three preferences show only two themes, so one step of any three-step cycle
 * changes nothing on screen. This picks WHICH step does that: the step out of
 * `system`, into the explicit mode that is already showing. That step means
 * "keep this look and stop following the OS", and the glyph changing from the
 * monitor is the whole of its effect. Every click from an explicit mode
 * changes the theme, so the first click from the default always does
 * something.
 *
 * The order follows from that. On a dark OS it is dark → light → system → dark,
 * and on a light OS it is dark → system → light → dark. A fixed order can't do
 * this, because each order has an OS on which a step into `system` is the
 * invisible one.
 */
export function nextColorModePreference(
  preference: ColorModePreference,
  system: ColorModeValue,
): ColorModePreference {
  if (preference === "system") return system;
  const other = preference === "dark" ? "light" : "dark";
  return system === other ? "system" : other;
}
