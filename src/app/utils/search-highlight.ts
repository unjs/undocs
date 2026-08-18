/**
 * Query-term highlighting for the search palette — shared by the result list and
 * the preview pane so both mark the same words the same way.
 *
 * MiniSearch reports which TERMS matched, never where in the text they matched
 * (its index is tokenized, the stored preview is not). So the ranges are
 * re-derived here from the terms, and because the query options match on PREFIX,
 * a term is highlighted together with the rest of the word it started
 * (`instal` → `install`) — otherwise a prefix hit marks half a word.
 */

export interface Segment {
  text: string;
  mark: boolean;
}

/** Longest snippet, in characters, `snippet()` will cut out of a section. */
export const SNIPPET_MAX = 140;

/** Characters of leading context kept before the first match in a snippet. */
const SNIPPET_LEAD = 40;

export function toSegments(text: string, ranges: [number, number][]): Segment[] {
  if (!ranges.length) return text ? [{ text, mark: false }] : [];
  const out: Segment[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (end <= cursor) continue;
    const from = Math.max(start, cursor);
    if (from > cursor) out.push({ text: text.slice(cursor, from), mark: false });
    out.push({ text: text.slice(from, end), mark: true });
    cursor = end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), mark: false });
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// MiniSearch returns terms, not offsets; highlight whole prefix-matched words.
export function matchRanges(text: string, terms: string[]): [number, number][] {
  const words = terms.filter(Boolean);
  if (!text || !words.length) return [];
  const alt = words
    .map(escapeRegExp)
    .sort((a, b) => b.length - a.length)
    .join("|");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt})[\\p{L}\\p{N}]*`, "giu");
  const ranges: [number, number][] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    ranges.push([m.index, m.index + m[0].length]);
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return ranges;
}

/** Split `text` into marked/unmarked runs. Used where the whole text is shown. */
export function highlight(text: string, terms: string[]): Segment[] {
  return toSegments(text, matchRanges(text, terms));
}

/** Does `text` contain any of `terms`? Cheaper than building the segments. */
export function hasMatch(text: string, terms: string[]): boolean {
  return matchRanges(text, terms).length > 0;
}

/** A bounded window around the first match, elided on both sides when cut. */
export function snippet(content: string, terms: string[]): Segment[] {
  const raw = content || "";
  if (!raw.trim()) return [];
  const ranges = matchRanges(raw, terms);
  const offset = ranges.length && ranges[0][0] > SNIPPET_LEAD ? ranges[0][0] - SNIPPET_LEAD : 0;
  const text = raw.slice(offset, offset + SNIPPET_MAX);
  const shifted = ranges
    .map(([s, e]) => [s - offset, e - offset] as [number, number])
    .filter(([s, e]) => e > 0 && s < text.length)
    .map(([s, e]) => [Math.max(0, s), Math.min(text.length, e)] as [number, number]);
  const segments = toSegments(text, shifted);
  if (offset > 0) segments.unshift({ text: "…", mark: false });
  if (offset + SNIPPET_MAX < raw.length) segments.push({ text: "…", mark: false });
  return segments;
}
