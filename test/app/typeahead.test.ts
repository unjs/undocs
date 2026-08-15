import { describe, expect, it, vi } from "vitest";
import {
  getNextMatch,
  useTypeahead,
  wrapArray,
} from "@app/components/ui/primitives/useTypeahead.ts";

/**
 * Letter-key navigation in `DropdownMenu` (ported from reka-ui, see
 * `useTypeahead.ts`). The matcher is pure and the only part with any behaviour
 * in it: which item a keystroke moves to depends on where focus already is, and
 * getting that wrong makes duplicate labels unreachable or turns a repeated key
 * into a no-op. The focusing itself is one `.focus()` call in the menu and needs
 * a browser; vitest runs in `node`.
 */
const ITEMS = ["Copy Markdown Link", "View as Markdown", "Open in ChatGPT", "Open in Claude"];

describe("typeahead matching", () => {
  it("matches on the start of a label, case-insensitively", () => {
    expect(getNextMatch(ITEMS, "v")).toBe("View as Markdown");
    expect(getNextMatch(ITEMS, "COPY")).toBe("Copy Markdown Link");
  });

  it("looks FORWARD from the current item, so duplicates stay reachable", () => {
    // Both "Open in …" entries match `o`. From the first, `o` must reach the
    // second — a naive `find` would return the first one forever.
    expect(getNextMatch(ITEMS, "o", "Open in ChatGPT")).toBe("Open in Claude");
  });

  it("wraps around the end of the list", () => {
    expect(getNextMatch(ITEMS, "o", "Open in Claude")).toBe("Open in ChatGPT");
  });

  it("cycles on a repeated character instead of re-matching the current item", () => {
    // `ooo` is normalized to `o`; without that it would match nothing at all.
    expect(getNextMatch(ITEMS, "ooo", "Open in ChatGPT")).toBe("Open in Claude");
  });

  it("keeps a multi-character query on the item it already matches", () => {
    // Refining `op` → `open in c` must not jump away from a still-valid match.
    expect(getNextMatch(ITEMS, "open in c", "Open in ChatGPT")).toBeUndefined();
  });

  it("returns undefined when nothing matches, so focus stays put", () => {
    expect(getNextMatch(ITEMS, "z")).toBeUndefined();
    expect(getNextMatch([], "a")).toBeUndefined();
  });

  it("wraps an array around a start index", () => {
    expect(wrapArray(["a", "b", "c", "d"], 2)).toEqual(["c", "d", "a", "b"]);
    expect(wrapArray(["a", "b", "c", "d"], 0)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("typeahead search buffer", () => {
  it("accumulates keys into one query and reports the index to move to", () => {
    const typeahead = useTypeahead();
    expect(typeahead.next("o", ITEMS, -1)).toBe(2); // "Open in ChatGPT"
    // The second key REFINES the query rather than starting a new search.
    expect(typeahead.search).toBe("o");
    expect(typeahead.next("p", ITEMS, 2)).toBe(-1);
    expect(typeahead.search).toBe("op");
  });

  it("forgets the query after the idle window, so a later key starts fresh", () => {
    vi.useFakeTimers();
    try {
      const typeahead = useTypeahead(1000);
      typeahead.next("o", ITEMS, -1);
      vi.advanceTimersByTime(999);
      expect(typeahead.search).toBe("o");
      vi.advanceTimersByTime(1);
      expect(typeahead.search).toBe("");
      // `v` alone, not `ov` — which would match nothing.
      expect(typeahead.next("v", ITEMS, -1)).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("resets on demand", () => {
    const typeahead = useTypeahead();
    typeahead.next("o", ITEMS, -1);
    typeahead.reset();
    expect(typeahead.search).toBe("");
  });
});
