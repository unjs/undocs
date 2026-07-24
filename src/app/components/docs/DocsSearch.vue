<script setup lang="ts">
import { computed, markRaw, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { useRouter } from "@app/router";
import { useDocsSearch } from "@app/composables/useDocsSearch";
import { querySearchIndex } from "@app/composables/useContent";
import { useAsyncData } from "@app/composables/useAsyncData";
import {
  MINISEARCH_OPTIONS,
  MINISEARCH_SEARCH_OPTIONS,
  MINISEARCH_FUZZY_SEARCH_OPTIONS,
  toSearchDocuments,
} from "@server/content/search-options";
import type { SearchDocument } from "@server/content/search-options";
import Icon from "@app/components/global/Icon.vue";
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  VisuallyHidden,
} from "reka-ui";
import MiniSearch from "minisearch";

interface SearchSection {
  id: string;
  title: string;
  titles: string[];
  level: number;
  content: string;
}

interface NavItem {
  title: string;
  path: string;
  icon?: string;
  page?: boolean;
  children?: NavItem[];
  [key: string]: any;
}

const props = withDefaults(
  defineProps<{
    navigation?: NavItem[] | null;
    shortcut?: string;
  }>(),
  {
    navigation: () => [],
    shortcut: "meta_k",
  },
);

const router = useRouter();
const { open, close } = useDocsSearch();

const query = ref("");
const activeIndex = ref(0);
const listEl = ref<HTMLElement | null>(null);

// --- fuzzy search ------------------------------------------------------------
// MiniSearch does the matching. The server ships a pre-built, serialized index
// (`/api/docs/search`) that we rehydrate with `MiniSearch.loadJS` — the browser
// never re-indexes. A search hit carries the section's stored fields (title,
// titles, level, content) plus `terms` (the indexed words that matched), which
// we use to highlight occurrences.
const RESULT_LIMIT = 40;

interface ResultRow {
  section: SearchSection;
  terms: string[];
}

// Instant fallback: the nav tree is seeded into the SSR payload, so it's on the
// client immediately, whereas the full index is fetched lazily from
// /api/docs/search after the palette first opens. We index the nav pages
// on-device (same options) and search that until the richer index (headings +
// body text) lands, then transparently upgrade.
function flattenNav(
  items: NavItem[] | null | undefined,
  out: SearchSection[] = [],
  seen: Set<string> = new Set(),
): SearchSection[] {
  for (const item of items || []) {
    // A section with an index page appears twice in the tree — as the `page`
    // parent and as its own re-added first child (same `path`). Dedupe by path so
    // the browse list and the fallback index don't carry duplicates.
    if (item.page && item.path && !seen.has(item.path)) {
      seen.add(item.path);
      out.push({
        id: item.path,
        title: item.title,
        titles: [],
        level: 1,
        content: item.description || "",
      });
    }
    if (item.children) flattenNav(item.children, out, seen);
  }
  return out;
}

const navSections = computed(() => flattenNav(props.navigation));

// The nav-only fallback index, built on-device from the SSR-seeded nav tree.
// `markRaw` keeps Vue from deep-proxying the instance's internal Maps.
const navIndex = computed(() => {
  const ms = new MiniSearch<SearchDocument>(MINISEARCH_OPTIONS);
  ms.addAll(toSearchDocuments(navSections.value));
  return markRaw(ms);
});

// The full index is fetched + rehydrated lazily the first time the palette opens
// (see the `open` watcher below) — not on every page load. `shallowRef` (not a
// deep `ref`) so the MiniSearch instance is stored as-is, never proxied.
const fullIndex = shallowRef<MiniSearch<SearchDocument> | null>(null);
const indexPending = ref(false);
let indexRequested = false;

async function loadIndex() {
  if (indexRequested) return;
  indexRequested = true;
  indexPending.value = true;
  // Route through the shared "search" async-data entry: if `prefetch.ts` already
  // warmed it, this resolves instantly with the cached serialized index and no
  // second request is made. `useAsyncData` stores errors on the entry (never
  // rejects), so we inspect the refs rather than catch.
  const entry = await useAsyncData("search", () => querySearchIndex());
  // A prior attempt (or a failed prefetch) leaves the entry empty — refetch once.
  if (entry.error.value || !entry.data.value) {
    await entry.refresh();
  }
  if (entry.data.value) {
    fullIndex.value = markRaw(
      MiniSearch.loadJS<SearchDocument>(entry.data.value, MINISEARCH_OPTIONS),
    );
  } else {
    indexRequested = false; // still failed — allow a retry on the next open
  }
  indexPending.value = false;
}

const index = computed<MiniSearch<SearchDocument>>(() => fullIndex.value ?? navIndex.value);

// True while the instant nav fallback is serving results and the full index is
// still loading — drives the spinner so the upgrade is visible.
const indexLoading = computed(() => indexPending.value && navSections.value.length > 0);

const results = computed<ResultRow[]>(() => {
  const q = query.value.trim();
  if (!q) {
    // No query: surface the top nav pages as a browse list.
    return navSections.value.slice(0, 20).map((section) => ({ section, terms: [] }));
  }
  // Strict pass first (precise: all terms must match). If it finds nothing, fall
  // back to a relaxed pass that tolerates typos, partial words, and incomplete
  // input — better to show approximate results than an empty "no results" state.
  let hits = index.value.search(q, MINISEARCH_SEARCH_OPTIONS);
  if (hits.length === 0) {
    hits = index.value.search(q, MINISEARCH_FUZZY_SEARCH_OPTIONS);
  }
  const rows: ResultRow[] = [];
  for (let i = 0; i < hits.length && rows.length < RESULT_LIMIT; i++) {
    const hit = hits[i] as unknown as SearchDocument & { terms: string[] };
    rows.push({
      section: {
        id: hit.id,
        title: hit.title,
        titles: hit.titles || [],
        level: hit.level,
        // `content` isn't stored (indexed only); the bounded `preview` is what we
        // render as the snippet.
        content: hit.preview || "",
      },
      terms: hit.terms,
    });
  }
  return rows;
});

// Reset selection whenever the result set changes.
watch(results, () => {
  activeIndex.value = 0;
});

// "Did you mean …": when even the relaxed pass finds nothing, ask MiniSearch for
// the closest query it *could* satisfy. `autoSuggest` re-runs the search with the
// given (fuzzy) options and assembles candidate query strings from the terms of
// matching documents — so "llmsfulsss" → "llms full". Only surfaced in the empty
// state, and only when the suggestion actually differs from what was typed.
const suggestion = computed<string>(() => {
  const q = query.value.trim();
  if (!q || results.value.length > 0) return "";
  const top = index.value.autoSuggest(q, MINISEARCH_FUZZY_SEARCH_OPTIONS)[0]?.suggestion?.trim();
  return top && top.toLowerCase() !== q.toLowerCase() ? top : "";
});

function applySuggestion() {
  if (suggestion.value) query.value = suggestion.value;
}

// Fetch the full index on first open; reset input/selection on close.
watch(open, (value) => {
  if (value) {
    loadIndex();
  } else {
    query.value = "";
    activeIndex.value = 0;
  }
});

// --- match highlighting ------------------------------------------------------
const SNIPPET_MAX = 140;

interface Segment {
  text: string;
  mark: boolean;
}

// Split `text` into plain/marked segments from [start, end) exclusive ranges.
function toSegments(text: string, ranges: [number, number][]): Segment[] {
  if (!ranges.length) return text ? [{ text, mark: false }] : [];
  const out: Segment[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (end <= cursor) continue; // fully covered by a previous range
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

// MiniSearch returns which indexed *terms* matched, not character offsets. Find
// each term in `text` (case-insensitively, only where a word starts with it,
// since matches are prefix/word-based) and extend to the end of that word so the
// whole matched word is highlighted. Ranges come back in ascending order.
function matchRanges(text: string, terms: string[]): [number, number][] {
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
    if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-length matches
  }
  return ranges;
}

function highlight(text: string, terms: string[]): Segment[] {
  return toSegments(text, matchRanges(text, terms));
}

// Build a snippet windowed around the first content match, with highlights.
function snippet(content: string, terms: string[]): Segment[] {
  const raw = content || "";
  if (!raw.trim()) return [];
  const ranges = matchRanges(raw, terms);
  const offset = ranges.length && ranges[0][0] > 40 ? ranges[0][0] - 40 : 0;
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

function routeFor(section: SearchSection): { path: string; hash?: string } {
  const [path, anchor] = section.id.split("#");
  return anchor ? { path, hash: `#${anchor}` } : { path };
}

// --- grouping ----------------------------------------------------------------
// Consecutive hits that resolve to the same page are collapsed into one grouped
// item: a page header (the page-level hit if one matched, else a synthesized
// entry that navigates to the page top) with the page's matching sections nested
// beneath it. Only *consecutive* runs are merged, so relevance ranking is
// preserved — a page whose sections rank far apart still appears as separate
// groups. Both the header and every nested section stay individually selectable,
// so `navList` re-flattens them into the keyboard-navigation order the render
// uses, and `activeIndex` indexes into that flat list.
interface RenderSection {
  index: number;
  section: SearchSection;
  terms: string[];
  heading: string;
  crumb: string;
}

interface RenderGroup {
  path: string;
  header: {
    index: number;
    section: SearchSection;
    title: string;
    parents: string[];
    terms: string[];
    isHit: boolean;
  };
  sections: RenderSection[];
}

const grouped = computed<{ groups: RenderGroup[]; nav: SearchSection[] }>(() => {
  // First pass: bucket consecutive rows by page path, splitting each page's own
  // level-1 hit (no `#anchor`) from its section hits.
  const buckets: { path: string; pageRow?: ResultRow; sections: ResultRow[] }[] = [];
  let current: (typeof buckets)[number] | null = null;
  for (const row of results.value) {
    const { path } = routeFor(row.section);
    if (!current || current.path !== path) {
      current = { path, pageRow: undefined, sections: [] };
      buckets.push(current);
    }
    if (row.section.id.includes("#")) current.sections.push(row);
    else current.pageRow = row;
  }

  // Second pass: build the render groups and, in lockstep, the flat nav list so
  // every entry gets its keyboard index in render order (header, then sections).
  const groups: RenderGroup[] = [];
  const nav: SearchSection[] = [];
  for (const b of buckets) {
    // Highlight the page title with every term matched anywhere in the group, so
    // a page that only matched via a section still highlights in the header.
    const terms = [
      ...new Set([...(b.pageRow?.terms || []), ...b.sections.flatMap((s) => s.terms)]),
    ];
    const title = b.pageRow
      ? b.pageRow.section.title
      : b.sections[0]?.section.titles?.[0] || b.sections[0]?.section.title || b.path;
    const parents = b.pageRow?.section.titles || [];
    const headerSection: SearchSection = b.pageRow?.section ?? {
      id: b.path,
      title,
      titles: parents,
      level: 1,
      content: "",
    };
    const header = {
      index: nav.length,
      section: headerSection,
      title,
      parents,
      terms,
      isHit: !!b.pageRow,
    };
    nav.push(headerSection);
    const sections = b.sections.map<RenderSection>((row) => {
      const item = {
        index: nav.length,
        section: row.section,
        terms: row.terms,
        heading: row.section.title,
        // Drop the leading page title (shown in the header) from the breadcrumb.
        crumb: (row.section.titles || []).slice(1).join(" › "),
      };
      nav.push(row.section);
      return item;
    });
    groups.push({ path: b.path, header, sections });
  }
  return { groups, nav };
});

const renderGroups = computed(() => grouped.value.groups);
const navList = computed(() => grouped.value.nav);

function select(section: SearchSection | undefined) {
  if (!section) return;
  router.push(routeFor(section));
  close();
}

// A group header is either a real page-level hit (navigate to the page) or a
// synthesized lead for a page that only matched via its sections. The synthesized
// lead has no content of its own, so selecting it jumps to the group's first
// matching section rather than the bare page top.
function headerTarget(group: RenderGroup): SearchSection {
  return group.header.isHit || !group.sections.length
    ? group.header.section
    : group.sections[0].section;
}

// --- keyboard navigation -----------------------------------------------------
// Arrow keys jump between groups (page headers), not through every nested
// section — stepping one heading at a time is tedious when a page matches many.
// The mouse can still land on any nested section (`onItemMouseMove`); from such a
// section, ↓ advances to the next group and ↑ to the previous one.
function move(delta: number) {
  const headers = renderGroups.value.map((group) => group.header.index);
  if (headers.length === 0) return;
  // The group currently containing `activeIndex` is the last header at or before
  // it (headers are in ascending render order).
  let g = 0;
  for (let i = 0; i < headers.length && headers[i] <= activeIndex.value; i++) {
    g = i;
  }
  g = (g + delta + headers.length) % headers.length;
  activeIndex.value = headers[g];
  scrollActiveIntoView();
}

function scrollActiveIntoView() {
  nextTick(() => {
    const el = listEl.value?.querySelector<HTMLElement>("[data-active='true']");
    el?.scrollIntoView({ block: "nearest" });
  });
}

// Hovering an item selects it — but scrolling the list via arrow keys also fires
// `mousemove` on the item now under a stationary cursor, which would clobber the
// keyboard selection. Real movement changes the pointer coords; scroll-induced
// events keep them, so ignore anything at the same position as last time.
let lastPointerX = -1;
let lastPointerY = -1;

function onItemMouseMove(event: MouseEvent, index: number) {
  if (event.clientX === lastPointerX && event.clientY === lastPointerY) return;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  activeIndex.value = index;
}

function onInputKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case "ArrowDown": {
      event.preventDefault();
      move(1);
      break;
    }
    case "ArrowUp": {
      event.preventDefault();
      move(-1);
      break;
    }
    case "Enter": {
      event.preventDefault();
      // If the selection is on a group header, resolve it through `headerTarget`
      // so a synthesized lead jumps to its first section; otherwise select the
      // section at the active index directly.
      const group = renderGroups.value.find((g) => g.header.index === activeIndex.value);
      select(group ? headerTarget(group) : navList.value[activeIndex.value]);
      break;
    }
  }
}

// --- global shortcut (e.g. "meta_k" → Cmd/Ctrl+K) ----------------------------
function matchesShortcut(event: KeyboardEvent): boolean {
  const parts = (props.shortcut || "").toLowerCase().split("_").filter(Boolean);
  if (parts.length === 0) return false;
  const key = parts[parts.length - 1];
  const needMeta = parts.includes("meta");
  const needShift = parts.includes("shift");
  const needAlt = parts.includes("alt");
  if (needMeta && !(event.metaKey || event.ctrlKey)) return false;
  if (needShift && !event.shiftKey) return false;
  if (needAlt && !event.altKey) return false;
  return event.key.toLowerCase() === key;
}

function onGlobalKeydown(event: KeyboardEvent) {
  if (matchesShortcut(event)) {
    event.preventDefault();
    open.value = !open.value;
  }
}

onMounted(() => {
  window.addEventListener("keydown", onGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onGlobalKeydown);
});
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
      />
      <DialogContent
        class="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-top-2"
      >
        <VisuallyHidden as-child>
          <DialogTitle>Search documentation</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden as-child>
          <DialogDescription
            >Search across the documentation and jump to a section.</DialogDescription
          >
        </VisuallyHidden>

        <!-- input -->
        <div class="flex items-center gap-2 border-b border-border px-4">
          <Icon name="i-lucide-search" class="size-4 shrink-0 text-muted-foreground" />
          <input
            v-model="query"
            type="text"
            placeholder="Search documentation..."
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            class="w-full bg-transparent py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            @keydown="onInputKeydown"
          />
          <Icon
            v-if="indexLoading"
            name="i-lucide-loader-circle"
            class="size-4 shrink-0 animate-spin text-muted-foreground"
            aria-label="Loading full search index"
          />
          <kbd
            class="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block"
          >
            Esc
          </kbd>
        </div>

        <!-- results -->
        <div ref="listEl" class="max-h-[60vh] overflow-y-auto p-2">
          <template v-if="renderGroups.length">
            <div
              v-for="group in renderGroups"
              :key="`${group.path}#${group.header.index}`"
              class="mb-1 last:mb-0"
            >
              <!-- page header -->
              <button
                type="button"
                :data-active="group.header.index === activeIndex"
                class="flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left outline-none transition-colors"
                :class="
                  group.header.index === activeIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground hover:bg-accent/50'
                "
                @click="select(headerTarget(group))"
                @mousemove="onItemMouseMove($event, group.header.index)"
              >
                <span v-if="group.header.parents.length" class="text-xs text-muted-foreground">
                  {{ group.header.parents.join(" › ") }}
                </span>
                <span class="flex items-center gap-2 text-sm font-medium">
                  <Icon name="i-lucide-file-text" class="size-3.5 shrink-0 text-muted-foreground" />
                  <span class="min-w-0 truncate">
                    <template
                      v-for="(seg, i) in highlight(group.header.title, group.header.terms)"
                      :key="i"
                      ><mark
                        v-if="seg.mark"
                        class="rounded bg-primary/15 font-semibold text-primary"
                        >{{ seg.text }}</mark
                      ><template v-else>{{ seg.text }}</template></template
                    >
                  </span>
                </span>
                <span
                  v-if="
                    group.header.isHit &&
                    snippet(group.header.section.content, group.header.terms).length
                  "
                  class="truncate text-xs text-muted-foreground"
                >
                  <template
                    v-for="(seg, i) in snippet(group.header.section.content, group.header.terms)"
                    :key="i"
                    ><mark v-if="seg.mark" class="bg-transparent font-medium text-foreground">{{
                      seg.text
                    }}</mark
                    ><template v-else>{{ seg.text }}</template></template
                  >
                </span>
              </button>

              <!-- matching sections within the page -->
              <div v-if="group.sections.length" class="ml-4 border-l border-border pl-1">
                <button
                  v-for="s in group.sections"
                  :key="s.section.id"
                  type="button"
                  :data-active="s.index === activeIndex"
                  class="flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left outline-none transition-colors"
                  :class="
                    s.index === activeIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent/50'
                  "
                  @click="select(s.section)"
                  @mousemove="onItemMouseMove($event, s.index)"
                >
                  <span v-if="s.crumb" class="text-xs text-muted-foreground">
                    {{ s.crumb }}
                  </span>
                  <span class="flex items-center gap-2 text-sm font-medium">
                    <Icon name="i-lucide-hash" class="size-3.5 shrink-0 text-muted-foreground" />
                    <span class="min-w-0 truncate">
                      <template v-for="(seg, i) in highlight(s.heading, s.terms)" :key="i"
                        ><mark
                          v-if="seg.mark"
                          class="rounded bg-primary/15 font-semibold text-primary"
                          >{{ seg.text }}</mark
                        ><template v-else>{{ seg.text }}</template></template
                      >
                    </span>
                  </span>
                  <span
                    v-if="snippet(s.section.content, s.terms).length"
                    class="truncate text-xs text-muted-foreground"
                  >
                    <template v-for="(seg, i) in snippet(s.section.content, s.terms)" :key="i"
                      ><mark v-if="seg.mark" class="bg-transparent font-medium text-foreground">{{
                        seg.text
                      }}</mark
                      ><template v-else>{{ seg.text }}</template></template
                    >
                  </span>
                </button>
              </div>
            </div>
          </template>

          <div
            v-else
            class="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground"
          >
            <Icon name="i-lucide-search-x" class="size-6" />
            <span>No results for "{{ query }}"</span>
            <span v-if="suggestion">
              Did you mean
              <button
                type="button"
                class="font-medium text-primary underline-offset-2 hover:underline"
                @click="applySuggestion"
              >
                {{ suggestion }}</button
              >?
            </span>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
