/**
 * Ported from reka-ui's `useTypeahead` (MIT,
 * https://github.com/unovue/reka-ui). Search wraps after the current item;
 * repeated single-character queries exclude it to cycle matches, while real
 * multi-character refinement may keep it.
 *
 * Dropped, and why:
 * - reka Collection entries and direct focusing: plain labels and a returned
 *   index let the caller own DOM lookup and make matching DOM-free to test.
 * - VueUse `refAutoReset`: no render reads the query, so a plain timer suffices.
 */
import { onScopeDispose } from "vue";

export function wrapArray<T>(array: T[], startIndex: number): T[] {
  return array.map((_, index) => array[(startIndex + index) % array.length]!);
}

/** Return the next forward match without moving to the sole current match. */
export function getNextMatch(
  values: string[],
  query: string,
  current?: string,
): string | undefined {
  const isRepeated = query.length > 1 && [...query].every((char) => char === query[0]);
  const normalized = isRepeated ? query[0]! : query;
  let wrapped = wrapArray(values, Math.max(values.indexOf(current ?? ""), 0));
  if (normalized.length === 1) wrapped = wrapped.filter((value) => value !== current);
  const next = wrapped.find((value) => value.toLowerCase().startsWith(normalized.toLowerCase()));
  return next === current ? undefined : next;
}

export interface Typeahead {
  readonly search: string;
  next: (key: string, values: string[], currentIndex: number) => number;
  reset: () => void;
}

export function useTypeahead(resetAfter = 1000): Typeahead {
  let search = "";
  let timer: ReturnType<typeof setTimeout> | undefined;

  const reset = () => {
    search = "";
    clearTimeout(timer);
    timer = undefined;
  };

  // Permit DOM-free use outside a component scope.
  onScopeDispose(reset, true);

  return {
    get search() {
      return search;
    },
    reset,
    next(key, values, currentIndex) {
      search += key;
      clearTimeout(timer);
      timer = setTimeout(reset, resetAfter);
      const current = currentIndex === -1 ? undefined : values[currentIndex];
      const match = getNextMatch(values, search, current);
      return match === undefined ? -1 : values.indexOf(match);
    },
  };
}
