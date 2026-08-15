/**
 * `cn()` — the shadcn class-merge helper used by every vendored component.
 *
 * `clsx` flattens conditional/array/object class inputs into a string;
 * `tailwind-merge` then de-duplicates conflicting Tailwind utilities so the
 * last-declared wins (e.g. `cn("px-2", "px-4")` -> `"px-4"`).
 *
 * Auto-imported: `src/app/utils` is an auto-import dir (see vite.config.ts), so
 * templates/components reference `cn(...)` without importing it.
 */
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The Geist type scale (`tokens.css`) adds font sizes under names tailwind-merge
 * cannot recognise. Its `text-*` heuristic only treats a suffix as a SIZE when it
 * looks like one (`sm`, `2xl`, a number, a length); `text-heading-32` and
 * `text-button-14` look like arbitrary theme keys, so it files them under
 * font-COLOR instead — and then silently drops them whenever a real colour like
 * `text-primary-foreground` appears in the same `cn()` call.
 *
 * That is not a styling nit: it is why a Geist-sized button rendered at the
 * inherited font size. Declaring the names here puts them back in the `font-size`
 * group, so a size and a colour coexist and two sizes still collapse.
 */
const GEIST_TEXT_SIZES = [
  ...[32, 24, 20, 16, 14].map((n) => `heading-${n}`),
  ...[16, 14].map((n) => `copy-${n}`),
  "label-12",
  ...[16, 14, 12].map((n) => `button-${n}`),
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: GEIST_TEXT_SIZES }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
