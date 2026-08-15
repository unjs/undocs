/**
 * Breakpoint resolution for the Geist grid (vercel.com/geist/grid).
 *
 * Every Geist grid prop takes either one value or a per-breakpoint object —
 * `columns={{ sm: 1, md: 2, lg: 3 }}`. We resolve that HERE, in JS, into three
 * concrete CSS custom properties, and let three plain media queries pick which
 * one applies. Nothing measures the viewport at runtime.
 *
 * That is deliberate: a `matchMedia` read would give the server one column
 * count and the client's FIRST render another, which is precisely the
 * hydration mismatch the app forbids. Media queries have no such split — the
 * markup is identical in both passes and the browser resolves the breakpoint
 * during layout, before paint.
 *
 * Geist's sm/md/lg are mobile/tablet/desktop; we map them onto Tailwind's
 * `base` / `md:` (48rem) / `lg:` (64rem). The three `@media` blocks are
 * repeated verbatim in each grid component's scoped style — they have to be,
 * since a scoped stylesheet cannot import them, and Tailwind's `md:`/`lg:`
 * variants cannot generate `repeat(var(--x), …)` from a runtime value.
 */

export type Breakpoint = "sm" | "md" | "lg";

export const BREAKPOINTS = ["sm", "md", "lg"] as const satisfies readonly Breakpoint[];

/**
 * A single value, or one value per breakpoint.
 *
 * Constrained to primitives so `typeof value === "object"` is a sound test for
 * "this is the per-breakpoint form" — with an unconstrained `T` an object-typed
 * value would be indistinguishable from a breakpoint map. Every grid prop is a
 * line number or a span string, so the constraint costs nothing.
 */
export type Responsive<T extends string | number> = T | Partial<Record<Breakpoint, T>>;

export type Resolved<T> = Record<Breakpoint, T>;

/**
 * Flatten a responsive prop to a value for each of the three breakpoints.
 *
 * Unset breakpoints CASCADE UPWARD rather than falling back to `fallback`:
 * `{ sm: 1, lg: 3 }` means one column until `lg`, never a silent reset to the
 * default at `md`. That matches how the CSS would behave if the author had
 * written `md:`/`lg:` utilities by hand.
 */
export function resolveResponsive<T extends string | number>(
  value: Responsive<T> | undefined,
  fallback: T,
): Resolved<T> {
  if (value === undefined || value === null) {
    return { sm: fallback, md: fallback, lg: fallback };
  }
  if (typeof value !== "object") {
    return { sm: value, md: value, lg: value };
  }
  const sm = value.sm ?? fallback;
  const md = value.md ?? sm;
  const lg = value.lg ?? md;
  return { sm, md, lg };
}

/**
 * Emit a resolved prop as the `--ug-<name>-{sm,md,lg}` triple the scoped styles
 * read. Values are stringified so Vue writes them as-is; a numeric `0` must
 * survive, so this cannot go through a truthiness check.
 */
export function responsiveVars<T>(
  name: string,
  resolved: Resolved<T>,
  format: (value: T) => string = String,
): Record<string, string> {
  return {
    [`--ug-${name}-sm`]: format(resolved.sm),
    [`--ug-${name}-md`]: format(resolved.md),
    [`--ug-${name}-lg`]: format(resolved.lg),
  };
}

/**
 * Normalize a Geist cell coordinate to a CSS `grid-row`/`grid-column` value.
 *
 * Geist writes spans as `"1/3"`; CSS wants `1 / 3`. The slash MUST end up
 * surrounded by whitespace: these land in a custom property, and custom
 * properties substitute as a raw token stream — `1/-1` would tokenize the
 * `/-1` as one unit and the declaration would be dropped at computed-value
 * time, silently reverting the cell to auto placement.
 */
export function gridLine(value: string | number | undefined): string {
  if (value === undefined || value === null || value === "") {
    return "auto";
  }
  return String(value).replaceAll("/", " / ").replaceAll(/\s+/g, " ").trim();
}

/** One rendered guide overlay, and the breakpoints it stays visible across. */
export interface GuideLayer {
  key: Breakpoint;
  classes: string[];
  /** Interior vertical rules — one fewer than the column count. */
  vLines: number;
  /** Interior horizontal rules — one fewer than the row count. */
  hLines: number;
}

/**
 * Group the three breakpoints into as few guide overlays as their shapes allow.
 *
 * A guide overlay's line COUNT is fixed in markup, and no media query can add a
 * DOM node — so a responsive grid needs one overlay per distinct shape, swapped
 * by `display`. The CSS that does the swapping (`Grid.vue`) has each breakpoint
 * hide the one below it and show its own, which means an overlay can only be
 * shared by breakpoints that are ADJACENT. Hence merging against the previous
 * layer only: `{ sm: 1, md: 2, lg: 1 }` must produce three layers, because a
 * single `sm lg` overlay would be hidden by the `md` rule and never come back.
 */
export function guideLayers(
  columns: Resolved<number>,
  rows: Resolved<number>,
  hideGuides?: "row" | "column",
): GuideLayer[] {
  const layers: GuideLayer[] = [];
  for (const bp of BREAKPOINTS) {
    const vLines = hideGuides === "column" ? 0 : Math.max(0, columns[bp] - 1);
    const hLines = hideGuides === "row" ? 0 : Math.max(0, rows[bp] - 1);
    const previous = layers.at(-1);
    if (previous && previous.vLines === vLines && previous.hLines === hLines) {
      previous.classes.push(`ug-guides--${bp}`);
      continue;
    }
    layers.push({ key: bp, classes: [`ug-guides--${bp}`], vLines, hLines });
  }
  return layers;
}
