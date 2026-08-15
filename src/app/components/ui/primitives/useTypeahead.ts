/**
 * useTypeahead — jump to an item by typing the start of its label.
 *
 * Ported from reka-ui's `useTypeahead` (MIT, https://github.com/unovue/reka-ui),
 * which is where a menu's letter keys go. The matching is the whole of it, and
 * two rules in `getNextMatch` are the reason this is not three lines:
 *
 * - The candidate list is WRAPPED around the item that currently has focus, so
 *   the search always looks forward from where you are. Without that, typing `d`
 *   in a list with two `d` entries would always land on the first one and the
 *   second would be unreachable.
 * - A query of one repeated character (`ddd`) is normalized to that character
 *   AND excludes the current match, which is what turns repeated presses into a
 *   cycle through every `d` item. A longer real query keeps the current match in
 *   the running, so refining `de` → `dep` does not jump away from an item that
 *   still matches.
 *
 * Differences from reka: reka's version reads `textValue` off a Collection entry
 * and focuses the element itself. This one is handed plain strings and returns
 * an INDEX, so the caller owns both the collection and the focus — which is what
 * lets the menu use one `querySelectorAll` instead of a provide/inject
 * collection, and lets the matching be tested without a DOM
 * (`test/app/typeahead.test.ts`). reka's `refAutoReset` from `@vueuse/shared` is
 * a plain timer here; nothing renders from the search string, so it does not
 * need to be reactive.
 */
import { onScopeDispose } from "vue";

/** `wrapArray(["a","b","c","d"], 2) === ["c","d","a","b"]` */
export function wrapArray<T>(array: T[], startIndex: number): T[] {
  return array.map((_, index) => array[(startIndex + index) % array.length]!);
}

/**
 * The next value matching `query`, searching forward from `current`. Returns
 * `undefined` when nothing else matches — including when the only match IS the
 * current one, so a fruitless search never moves focus.
 */
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
  /** What has been typed so far; back to `""` once the reset delay elapses. */
  readonly search: string;
  /**
   * Record `key` and resolve where to go: the index in `values` to move to, or
   * `-1` for "stay put". `currentIndex` is `-1` when nothing is selected yet.
   */
  next: (key: string, values: string[], currentIndex: number) => number;
  /** Forget the query (a selection was made, the menu closed). */
  reset: () => void;
}

/**
 * `resetAfter` is reka's 1s idle window: long enough to type a word, short
 * enough that coming back to a menu starts a fresh search.
 */
export function useTypeahead(resetAfter = 1000): Typeahead {
  let search = "";
  let timer: ReturnType<typeof setTimeout> | undefined;

  const reset = () => {
    search = "";
    clearTimeout(timer);
    timer = undefined;
  };

  // `failSilently`: the matcher is useful (and tested) outside a component too.
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
