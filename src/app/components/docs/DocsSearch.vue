<script setup lang="ts">
import { computed, markRaw, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { useRouter } from "@app/router.ts";
import { useDocsSearch } from "@app/composables/useDocsSearch.ts";
import { querySearchIndex } from "@app/composables/useContent.ts";
import { useAsyncData } from "@app/composables/useAsyncData.ts";
import {
  MINISEARCH_OPTIONS,
  MINISEARCH_SEARCH_OPTIONS,
  MINISEARCH_FUZZY_SEARCH_OPTIONS,
  toSearchDocuments,
} from "@server/content/search-options.ts";
import type { SearchDocument } from "@server/content/search-options.ts";
import Icon from "@app/components/global/Icon.vue";
import Dialog from "@app/components/ui/Dialog.vue";
import Kbd from "@app/components/ui/Kbd.vue";
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

const RESULT_LIMIT = 40;

interface ResultRow {
  section: SearchSection;
  terms: string[];
}

// Search the hydrated nav immediately, then replace it with the lazy full index.
function flattenNav(
  items: NavItem[] | null | undefined,
  out: SearchSection[] = [],
  seen: Set<string> = new Set(),
): SearchSection[] {
  for (const item of items || []) {
    // Section index pages appear as both parent and child.
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

// MiniSearch's internal Maps must not be deeply proxied.
const navIndex = computed(() => {
  const ms = new MiniSearch<SearchDocument>(MINISEARCH_OPTIONS);
  ms.addAll(toSearchDocuments(navSections.value));
  return markRaw(ms);
});

const fullIndex = shallowRef<MiniSearch<SearchDocument> | null>(null);
const indexPending = ref(false);
let indexRequested = false;

async function loadIndex() {
  if (indexRequested) return;
  indexRequested = true;
  indexPending.value = true;
  // Reuse the prefetch cache; useAsyncData records errors instead of rejecting.
  const entry = await useAsyncData("search", () => querySearchIndex());
  if (entry.error.value || !entry.data.value) {
    await entry.refresh();
  }
  if (entry.data.value) {
    fullIndex.value = markRaw(
      MiniSearch.loadJS<SearchDocument>(entry.data.value, MINISEARCH_OPTIONS),
    );
  } else {
    indexRequested = false;
  }
  indexPending.value = false;
}

const index = computed<MiniSearch<SearchDocument>>(() => fullIndex.value ?? navIndex.value);

const indexLoading = computed(() => indexPending.value && navSections.value.length > 0);

const results = computed<ResultRow[]>(() => {
  const q = query.value.trim();
  if (!q) {
    return navSections.value.slice(0, 20).map((section) => ({ section, terms: [] }));
  }
  // Match all terms first; use the typo-tolerant pass only as a fallback.
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
        content: hit.preview || "",
      },
      terms: hit.terms,
    });
  }
  return rows;
});

const suggestion = computed<string>(() => {
  const q = query.value.trim();
  if (!q || results.value.length > 0) return "";
  const top = index.value.autoSuggest(q, MINISEARCH_FUZZY_SEARCH_OPTIONS)[0]?.suggestion?.trim();
  return top && top.toLowerCase() !== q.toLowerCase() ? top : "";
});

function applySuggestion() {
  if (suggestion.value) query.value = suggestion.value;
}

watch(open, (value) => {
  if (value) {
    loadIndex();
  } else {
    query.value = "";
    activeIndex.value = 0;
  }
});

const SNIPPET_MAX = 140;

interface Segment {
  text: string;
  mark: boolean;
}

function toSegments(text: string, ranges: [number, number][]): Segment[] {
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
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return ranges;
}

function highlight(text: string, terms: string[]): Segment[] {
  return toSegments(text, matchRanges(text, terms));
}

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

// Consecutive hits that resolve to the same page are collapsed into one grouped
// item: a page header (the page-level hit if one matched, else a synthesized
// entry that navigates to the page top) with the page's matching sections nested
// beneath it. Only *consecutive* runs are merged, so relevance ranking is
// preserved — a page whose sections rank far apart still appears as separate
// groups. `navList` re-flattens the groups in render order and `activeIndex`
// indexes into that flat list; `selectable` is the subset of those indices that
// are real hits (a synthesized lead is a label, not a result — see `move`).
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

const grouped = computed<{
  groups: RenderGroup[];
  nav: SearchSection[];
  selectable: number[];
}>(() => {
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

  const groups: RenderGroup[] = [];
  const nav: SearchSection[] = [];
  const selectable: number[] = [];
  for (const b of buckets) {
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
    if (header.isHit) selectable.push(header.index);
    const sections = b.sections.map<RenderSection>((row) => {
      const item = {
        index: nav.length,
        section: row.section,
        terms: row.terms,
        heading: row.section.title,
        crumb: (row.section.titles || []).slice(1).join(" › "),
      };
      selectable.push(item.index);
      nav.push(row.section);
      return item;
    });
    groups.push({ path: b.path, header, sections });
  }
  return { groups, nav, selectable };
});

const renderGroups = computed(() => grouped.value.groups);
const navList = computed(() => grouped.value.nav);

watch(grouped, (value) => {
  activeIndex.value = value.selectable[0] ?? 0;
});

function select(section: SearchSection | undefined) {
  if (!section) return;
  router.push(routeFor(section));
  close();
}

function headerTarget(group: RenderGroup): SearchSection {
  return group.header.isHit || !group.sections.length
    ? group.header.section
    : group.sections[0].section;
}

// Skip synthesized group labels during keyboard navigation.
function move(delta: number) {
  const items = grouped.value.selectable;
  if (items.length === 0) return;
  const current = items.indexOf(activeIndex.value);
  activeIndex.value =
    current === -1
      ? items[delta > 0 ? 0 : items.length - 1]
      : items[(current + delta + items.length) % items.length];
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
      select(navList.value[activeIndex.value]);
      break;
    }
  }
}

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
  <!-- `<Dialog>` is only the modal shell here — backdrop, focus trap, scroll
       lock, Escape/outside dismissal. The listbox below is hand-rolled: it owns
       Arrow/Enter through `onInputKeydown` on the input, and the shell
       deliberately does not compete for those keys (its focus scope only claims
       Tab, at the scope's edges). Escape is the shell's, and the palette never
       looks at it. -->
  <Dialog
    v-model:open="open"
    title="Search documentation"
    description="Search across the documentation and jump to a section."
    content-class="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-modal data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-top-2"
  >
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
      <Kbd class="hidden sm:inline-flex">Esc</Kbd>
    </div>

    <div ref="listEl" class="max-h-[60vh] overflow-y-auto p-2">
      <template v-if="renderGroups.length">
        <div
          v-for="group in renderGroups"
          :key="`${group.path}#${group.header.index}`"
          class="mb-1 last:mb-0"
        >
          <button
            type="button"
            :data-active="group.header.index === activeIndex"
            class="flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left outline-none transition-colors"
            :class="
              group.header.index === activeIndex
                ? 'bg-accent text-foreground'
                : 'text-foreground hover:bg-accent/50'
            "
            @click="select(headerTarget(group))"
            @mousemove="group.header.isHit && onItemMouseMove($event, group.header.index)"
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
                  ><mark v-if="seg.mark" class="rounded bg-brand/15 font-semibold text-brand">{{
                    seg.text
                  }}</mark
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

          <div v-if="group.sections.length" class="ml-4 border-l border-border pl-1">
            <button
              v-for="s in group.sections"
              :key="s.section.id"
              type="button"
              :data-active="s.index === activeIndex"
              class="flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left outline-none transition-colors"
              :class="
                s.index === activeIndex
                  ? 'bg-accent text-foreground'
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
                    ><mark v-if="seg.mark" class="rounded bg-brand/15 font-semibold text-brand">{{
                      seg.text
                    }}</mark
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
            class="font-medium text-brand underline-offset-2 hover:underline"
            @click="applySuggestion"
          >
            {{ suggestion }}</button
          >?
        </span>
      </div>
    </div>
  </Dialog>
</template>
