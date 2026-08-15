import type { InjectionKey } from "vue";

/**
 * Presence of a `GridSystem` ancestor.
 *
 * In Geist, `GridSystem` is what renders guides — a bare `Grid` is just a CSS
 * grid with no rule lines. `Grid` injects this to decide whether to emit its
 * guide layers at all, so the two states differ in MARKUP, not just in a class
 * that hides something already in the DOM.
 *
 * The guide width/style themselves travel as inherited custom properties
 * (`--ug-guide-width`, `--ug-guide-style`) rather than through here: they have
 * to reach the guide elements from a scoped stylesheet, which only inheritance
 * can do.
 */
export interface GridSystemContext {
  readonly enabled: true;
}

export const GRID_SYSTEM_KEY: InjectionKey<GridSystemContext> = Symbol.for("undocs-grid-system");
