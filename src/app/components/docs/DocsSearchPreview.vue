<script setup lang="ts">
/**
 * The search palette's right-hand pane (desktop only — `DocsSearch.vue` hides it
 * below `md`). It renders the ACTUAL page behind the highlighted result: the
 * page's AST is fetched over the same `/api/docs/page/*.json` route the docs page
 * uses, sliced from the matched heading, and handed to `MarkdownRenderer` with
 * every query term wrapped in a `<mark>`.
 *
 * `MarkdownRenderer` is DYNAMICALLY imported, under a local `<Suspense>` whose
 * fallback is the flat text outline `previewBlocks` derives from the same AST.
 * So the pane is never blank: on a docs page the chunk is already in memory and
 * the outline flashes for a tick; on the landing page (which does not load it)
 * the outline stands in for a real network fetch. The `<Suspense>` is local on
 * purpose — without it the async component would join `AppPage`'s boundary and
 * hold the whole PAGE behind a palette preview.
 *
 * Two more things it deliberately does:
 *
 * - The rendered markdown is `inert`. A preview of a page you are not on must not
 *   offer links that navigate, `#` anchors that scroll the page behind the modal,
 *   or copy buttons — and, inside a focus-trapped dialog, must not put a Tab stop
 *   on every one of them. `inert` covers hit-testing AND focus in one attribute;
 *   `pointer-events-none` rides along for browsers that predate it. A click then
 *   lands on the scroller instead and opens the result, which is the only thing a
 *   click in here could reasonably mean.
 * - It does NOT go through `useAsyncData`. That store is keyed by
 *   `kebabCase(route.path)` for the docs page, and this component fetches a page
 *   per keystroke of arrow-key movement — a namespace of its own would still
 *   grow one permanent entry per page the visitor ever hovered, for the lifetime
 *   of the tab. The instance-local `cache` below is the same win, scoped to the
 *   palette. It is per-INSTANCE (not module-level) on purpose: the pane only
 *   ever exists inside a mounted `<Dialog>`, i.e. never during SSR, and keeping
 *   the map on the instance is what makes that true by construction rather than
 *   by comment.
 */
import { computed, defineAsyncComponent, onUnmounted, ref, shallowRef, watch } from "vue";
import { queryPage } from "@app/composables/useContent.ts";
import { anchorIndex, previewBlocks, previewNodes } from "@app/utils/search-preview.ts";
import type { PreviewBlock } from "@app/utils/search-preview.ts";
import { highlight } from "@app/utils/search-highlight.ts";
import Icon from "@app/components/global/Icon.vue";
import Skeleton from "@app/components/ui/Skeleton.vue";
import type { MarkNode } from "@server/content/types.ts";

const MarkdownRenderer = defineAsyncComponent(() => import("@app/content/MarkdownRenderer.ts"));

const props = defineProps<{
  /** Route path of the active result's page. Empty when nothing is selected. */
  path: string;
  /** Heading anchor of the active result, if it is a section hit. */
  anchor?: string;
  /** Matched query terms, marked throughout the preview. */
  terms: string[];
  /** The active result's own label, shown as the pane's title. */
  title: string;
  /** Breadcrumb above the title, if the result has one. */
  crumb?: string;
}>();

const emit = defineEmits<{ open: [] }>();

/** How far past the matched heading the outline FALLBACK reads. */
const MAX_BLOCKS = 60;
/** Arrow-key movement fires a path change per keypress; only settle-then-fetch. */
const FETCH_DELAY = 120;

// Per-instance, so nothing is ever written during a server render. See header.
const cache = new Map<string, MarkNode[] | null>();

const body = shallowRef<MarkNode[] | null>(null);
const pending = ref(false);
const bodyEl = ref<HTMLElement | null>(null);

// Guards a stale response landing after the visitor has moved on.
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function load(path: string): void {
  const id = ++seq;
  if (timer) clearTimeout(timer);
  if (!path) {
    body.value = null;
    pending.value = false;
    return;
  }
  if (cache.has(path)) {
    body.value = cache.get(path) ?? null;
    pending.value = false;
    return;
  }
  pending.value = true;
  timer = setTimeout(async () => {
    let result: MarkNode[] | null = null;
    try {
      const page = await queryPage(path);
      result = page?.body?.value ?? null;
    } catch {
      // A page that will not load is shown as "no preview", not as an error.
      result = null;
    }
    if (id !== seq) return;
    // Cached either way: a 404 must not be retried on every re-selection.
    cache.set(path, result);
    body.value = result;
    pending.value = false;
  }, FETCH_DELAY);
}

watch(() => props.path, load, { immediate: true });

onUnmounted(() => {
  if (timer) clearTimeout(timer);
});

/** The rendered path. */
const nodes = computed<MarkNode[]>(() => previewNodes(body.value, props.anchor, props.terms));

/**
 * The fallback path. A `computed` is lazy, so this only ever runs when
 * `<Suspense>` is actually showing the outline.
 */
const blocks = computed<PreviewBlock[]>(() => {
  const all = previewBlocks(body.value);
  if (!all.length) return [];
  const start = anchorIndex(all, props.anchor);
  return all.slice(start, start + MAX_BLOCKS);
});

// A new selection is a new read; never inherit the previous one's scroll.
watch([() => props.path, () => props.anchor, body], () => {
  if (bodyEl.value) bodyEl.value.scrollTop = 0;
});

// h1 is the page title (already the pane's own heading); h2 leads a section and
// h3+ nest under it, so the outline's ladder only needs two steps.
function headingClass(depth: number | undefined): string {
  return (depth ?? 2) <= 2
    ? "mt-5 text-heading-14 text-foreground first:mt-0"
    : "mt-4 text-button-12 uppercase tracking-wide text-muted-foreground first:mt-0";
}
</script>

<template>
  <div class="flex min-w-0 flex-col">
    <template v-if="path">
      <div class="flex items-start gap-2 border-b border-border px-4 py-3">
        <Icon
          :name="anchor ? 'i-lucide-hash' : 'i-lucide-file-text'"
          class="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <div class="min-w-0 flex-1">
          <div class="truncate text-label-12 text-muted-foreground">{{ crumb || path }}</div>
          <div class="truncate text-copy-14 font-medium text-foreground">{{ title }}</div>
        </div>
      </div>

      <!-- The content is inert (see header), so the click lands here. -->
      <div
        ref="bodyEl"
        class="min-h-0 flex-1 cursor-pointer overflow-y-auto px-4 py-3"
        @click="emit('open')"
      >
        <div v-if="pending && !nodes.length" class="flex flex-col gap-2.5" aria-hidden="true">
          <Skeleton v-for="i in 7" :key="i" class="h-3" :class="i % 3 === 0 ? 'w-2/3' : 'w-full'" />
        </div>

        <div
          v-else-if="!nodes.length"
          class="flex h-full flex-col items-center justify-center gap-2 text-center text-label-12 text-muted-foreground"
        >
          <Icon name="i-lucide-file-question" class="size-5" />
          <span>No preview available</span>
        </div>

        <Suspense v-else>
          <MarkdownRenderer inert :body="nodes" class="md md-preview pointer-events-none" />

          <!-- Shown only while the renderer's chunk loads. Same AST, flattened. -->
          <template #fallback>
            <template v-for="(block, i) in blocks" :key="i">
              <h3 v-if="block.kind === 'heading'" :class="headingClass(block.depth)">
                <template v-for="(seg, s) in highlight(block.text, terms)" :key="s"
                  ><mark v-if="seg.mark" class="rounded-sm bg-brand/15 text-brand">{{
                    seg.text
                  }}</mark
                  ><template v-else>{{ seg.text }}</template></template
                >
              </h3>

              <pre
                v-else-if="block.kind === 'code'"
                class="mt-3 overflow-hidden rounded-md border border-border bg-muted px-3 py-2 font-mono text-label-12 text-muted-foreground"
              ><code>{{ block.text }}</code></pre>

              <p
                v-else
                class="mt-2.5 text-muted-foreground first:mt-0"
                :class="block.kind === 'row' ? 'text-label-12' : 'text-copy-14'"
              >
                <template v-for="(seg, s) in highlight(block.text, terms)" :key="s"
                  ><mark v-if="seg.mark" class="rounded-sm bg-brand/15 text-brand">{{
                    seg.text
                  }}</mark
                  ><template v-else>{{ seg.text }}</template></template
                >
              </p>
            </template>
          </template>
        </Suspense>
      </div>
    </template>

    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center gap-2 text-center text-label-12 text-muted-foreground"
    >
      <Icon name="i-lucide-panel-right" class="size-5" />
      <span>Select a result to preview it</span>
    </div>
  </div>
</template>
