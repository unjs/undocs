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
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
