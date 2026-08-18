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
import { highlight, snippet } from "@app/utils/search-highlight.ts";
import Icon from "@app/components/global/Icon.vue";
import Dialog from "@app/components/ui/Dialog.vue";
import Kbd from "@app/components/ui/Kbd.vue";
import DocsSearchPreview from "@app/components/docs/DocsSearchPreview.vue";
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

function routeFor(section: SearchSection): { path: string; hash?: string } {
  const [path, anchor] = section.id.split("#");
  return anchor ? { path, hash: `#${anchor}` } : { path };
}

// Consecutive hits that resolve to the same page are collapsed into one grouped
// item: a page header (the page-level hit if one matched, else a synthesized
// entry that navigates to the page top) with the page's matching sections nested
// beneath it. Only *consecutive* runs are merged, so relevance ranking is
// preserved — a page whose sections rank far apart still appears as separate
// groups. `nav` re-flattens the groups in render order and `activeIndex`
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

/**
 * One row of the flat list `activeIndex` addresses. It carries what the PREVIEW
 * pane needs as well as the target, because the pane titles itself with the
 * active result's own label rather than re-deriving one from the page.
 */
interface NavEntry {
  section: SearchSection;
  terms: string[];
  label: string;
  /** Full breadcrumb — unlike the list's, this one keeps the page title, since
   *  the pane has no group header above it to carry that context. */
  crumb: string;
}

const grouped = computed<{
  groups: RenderGroup[];
  nav: NavEntry[];
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
  const nav: NavEntry[] = [];
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
    nav.push({ section: headerSection, terms, label: title, crumb: parents.join(" › ") });
    if (header.isHit) selectable.push(header.index);
    const sections = b.sections.map<RenderSection>((row) => {
      const titles = row.section.titles || [];
      const item = {
        index: nav.length,
        section: row.section,
        terms: row.terms,
        heading: row.section.title,
        crumb: titles.slice(1).join(" › "),
      };
      selectable.push(item.index);
      nav.push({
        section: row.section,
        terms: row.terms,
        label: row.section.title,
        crumb: titles.join(" › "),
      });
      return item;
    });
    groups.push({ path: b.path, header, sections });
  }
  return { groups, nav, selectable };
});

const renderGroups = computed(() => grouped.value.groups);

/** The row the preview pane reads, and the one Enter opens. */
const activeEntry = computed<NavEntry | undefined>(() => grouped.value.nav[activeIndex.value]);

const activeRoute = computed(() =>
  activeEntry.value ? routeFor(activeEntry.value.section) : undefined,
);

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
      select(activeEntry.value?.section);
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
       looks at it.

       From `md` up the panel is TWO columns: a fixed-width result list and a
       preview of the active result's real content (`DocsSearchPreview`). Below
       `md` there is no room for a second column, so the pane is dropped and each
       row keeps the inline snippet that stands in for it.

       The panel is frosted glass, so the overlay passed here does two things
       differently from the shell's default: it drops `backdrop-blur-sm`, because
       the blur belongs to ONE surface, and it dims only lightly. The overlay
       paints UNDER the panel and is therefore most of what the panel's filter
       samples — at the shell's `/80` there is no page left in frame and the pane
       is a wash of overlay colour no matter how thin its own fill gets. Dimming
       is the knob that decides whether this is glass at all; the fill only
       decides how much. `bg-card` is off the panel for the same reason the
       opaque fallback lives in CSS — see the `<style>` block below. -->
  <Dialog
    v-model:open="open"
    title="Search documentation"
    description="Search across the documentation and jump to a section."
    overlay-class="fixed inset-0 z-50 bg-[var(--overlay)]/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
    content-class="search-panel fixed left-1/2 top-[10vh] z-50 flex w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border text-foreground shadow-modal md:top-[8vh] md:max-w-3xl lg:max-w-4xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-top-2"
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
      <!-- The hint moves into the footer once there is a footer to hold it. -->
      <Kbd class="hidden sm:inline-flex md:hidden">Esc</Kbd>
    </div>

    <div v-if="renderGroups.length" class="flex min-h-0 md:h-[min(70vh,34rem)]">
      <div
        ref="listEl"
        class="max-h-[60vh] w-full overflow-y-auto p-2 md:max-h-none md:w-[19rem] md:shrink-0 md:border-r md:border-border"
      >
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
            <span v-if="group.header.parents.length" class="truncate text-xs text-muted-foreground">
              {{ group.header.parents.join(" › ") }}
            </span>
            <span class="flex w-full items-center gap-2 text-sm font-medium">
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
            <!-- The preview pane supersedes this on desktop. -->
            <span
              v-if="
                group.header.isHit &&
                snippet(group.header.section.content, group.header.terms).length
              "
              class="truncate text-xs text-muted-foreground md:hidden"
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
              <span v-if="s.crumb" class="truncate text-xs text-muted-foreground">
                {{ s.crumb }}
              </span>
              <span class="flex w-full items-center gap-2 text-sm font-medium">
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
                class="truncate text-xs text-muted-foreground md:hidden"
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
      </div>

      <div class="hidden min-w-0 flex-1 md:flex">
        <DocsSearchPreview
          class="flex-1"
          :path="activeRoute?.path || ''"
          :anchor="activeRoute?.hash?.slice(1)"
          :terms="activeEntry?.terms || []"
          :title="activeEntry?.label || ''"
          :crumb="activeEntry?.crumb"
          @open="select(activeEntry?.section)"
        />
      </div>
    </div>

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

    <div
      class="hidden items-center gap-4 border-t border-border px-4 py-2 text-label-12 text-muted-foreground md:flex"
    >
      <span class="flex items-center gap-1.5">
        <Kbd :keys="['↑']" />
        <Kbd :keys="['↓']" />
        navigate
      </span>
      <span class="flex items-center gap-1.5">
        <Kbd :keys="['↵']" />
        open
      </span>
      <span class="ml-auto flex items-center gap-1.5">
        <Kbd>Esc</Kbd>
        close
      </span>
    </div>
  </Dialog>
</template>

<style>
/* The palette's pane of glass. The page behind a modal is a real backdrop, so
 * this earns the treatment the landing's hero code block does — and, like it,
 * blurs exactly ONCE: the backdrop root is the document, so the shell's overlay
 * (which would otherwise blur that same backdrop first, leaving this a second
 * pass over an already-blurred image) is passed above with dimming only.
 * Everything inside the panel — row hover/active fills, the header/footer rules,
 * the preview pane — is a tint over this one surface.
 *
 * The @supports runs the enhancement way round: without `backdrop-filter`,
 * translucency is not glass, it is the page showing through a text-dense
 * palette.
 *
 * What bounds the transparency is contrast, and the thing that BUYS it is the
 * tone clamp in the filter, not the fill. A pane over an arbitrary page has no
 * worst case until the backdrop is bounded: `contrast()` compresses whatever is
 * behind toward mid, `brightness()` then lands that band where the mode's own
 * page sits, and only then does the 50% `--card` fill go over it. So the pane
 * still SHOWS the page — the band it maps into is wide enough to read shapes —
 * while a full-bleed black code block (light) or light screenshot (dark) can no
 * longer drag the small `--muted-foreground` labels below AA: worst case ~5.0:1
 * light and ~4.7:1 dark, against ~6:1 over an ordinary page. This is why the
 * overlay could go down to 30% at all. Retune the three numbers together. */
.search-panel {
  background: var(--card);
  --panel-glass-tone: contrast(0.4) brightness(1.4);
}

html.dark .search-panel {
  --panel-glass-tone: contrast(0.4) brightness(0.55);
}

@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .search-panel {
    background: color-mix(in oklab, var(--card) 50%, transparent);
    -webkit-backdrop-filter: blur(24px) var(--panel-glass-tone);
    backdrop-filter: blur(24px) var(--panel-glass-tone);
  }
}
</style>
