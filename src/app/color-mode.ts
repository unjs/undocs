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
