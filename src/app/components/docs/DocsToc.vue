<script setup lang="ts">
/**
 * Heading offsets are cached because reading every rect on each scroll frame
 * forces layout. Body resize invalidates the cache for late content. The first
 * and last headings are explicit bounds because neither is guaranteed to cross
 * the reading line.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { cn } from "@app/utils/cn.ts";
import { useSectionTabs } from "@app/composables/useSectionTabs.ts";
import Tooltip from "@app/components/ui/Tooltip.vue";
import type { TocLink } from "../../../server/content/types.ts";

const { visible: hasSubnav } = useSectionTabs();

const props = defineProps<{
  title?: string;
  links: TocLink[];
  highlight?: boolean;
}>();

const HEADER_OFFSET = 80;
const SPY_LINE = HEADER_OFFSET + 24;
// Keep in sync with the CSS divisor below.
const LENS_REACH = 3;

function flatten(links: TocLink[] = [], acc: TocLink[] = []): TocLink[] {
  for (const link of links) {
    acc.push(link);
    if (link.children?.length) flatten(link.children, acc);
  }
  return acc;
}

const flatLinks = computed(() => flatten(props.links));
const activeId = ref<string>("");
const activeIndex = computed(() => flatLinks.value.findIndex((link) => link.id === activeId.value));

// No active item during SSR or first client render preserves hydration parity.
function lensDepth(index: number): number {
  const active = activeIndex.value;
  return Math.min(active < 0 ? 2 : Math.abs(index - active), LENS_REACH);
}

const containerEl = ref<HTMLElement>();
const navEl = ref<HTMLElement>();

const linkEls = new Map<string, HTMLElement>();
const truncated = ref<Set<string>>(new Set());

function setLinkEl(id: string, el: unknown) {
  if (el instanceof HTMLElement) linkEls.set(id, el);
  else linkEls.delete(id);
}

function measureTruncation() {
  const next = new Set<string>();
  for (const [id, el] of linkEls) {
    if (el.scrollWidth > el.clientWidth) next.add(id);
  }
  truncated.value = next;
}

const activeBox = ref<{ top: number; height: number }>();
const navHeight = ref(0);
const readFrac = ref(0);
const animated = ref(false);

const progress = computed(() => {
  const box = activeBox.value;
  if (!box || !navHeight.value) return 0;
  return Math.min((box.top + box.height * readFrac.value) / navHeight.value, 1);
});

// Rects include the link's scale; use untransformed layout coordinates.
function offsetWithin(el: HTMLElement, ancestor: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

function measureRail() {
  const el = activeId.value ? linkEls.get(activeId.value) : undefined;
  const nav = navEl.value;
  navHeight.value = nav?.offsetHeight ?? 0;
  if (!el || !nav) {
    activeBox.value = undefined;
    return;
  }
  activeBox.value = { top: offsetWithin(el, nav), height: el.offsetHeight };
  revealActive(el);
}

// Avoid `scrollIntoView`, which may also scroll the page's ancestors.
function revealActive(el: HTMLElement) {
  const box = containerEl.value;
  if (!box || box.scrollHeight <= box.clientHeight) return;
  const top = offsetWithin(el, box);
  const margin = 48;
  const behavior = animated.value ? "smooth" : "auto";
  if (top - margin < box.scrollTop) {
    box.scrollTo({ top: Math.max(0, top - margin), behavior });
  } else if (top + el.offsetHeight + margin > box.scrollTop + box.clientHeight) {
    box.scrollTo({ top: top + el.offsetHeight + margin - box.clientHeight, behavior });
  }
}

let spies: { id: string; el: HTMLElement; top: number }[] = [];

function measure() {
  spies = [];
  if (!props.highlight) return;
  for (const link of flatLinks.value) {
    const el = document.getElementById(link.id);
    if (el) spies.push({ id: link.id, el, top: 0 });
  }
  for (const spy of spies) {
    spy.top = spy.el.getBoundingClientRect().top + window.scrollY;
  }
}

// Lock the target while smooth scrolling passes intermediate headings.
const locked = ref(false);
let lockTimer: ReturnType<typeof setTimeout> | undefined;

function unlock() {
  locked.value = false;
  clearTimeout(lockTimer);
}

function lockSpy() {
  locked.value = true;
  clearTimeout(lockTimer);
  lockTimer = setTimeout(unlock, 1000);
}

function maxScroll(): number {
  return document.documentElement.scrollHeight - window.innerHeight;
}

function atBottom(): boolean {
  return window.scrollY >= maxScroll() - 32;
}

// The final section runs to the document bottom so progress can reach 100%.
function updateProgress() {
  const index = spies.findIndex((spy) => spy.id === activeId.value);
  if (index < 0) {
    readFrac.value = 0;
    return;
  }
  if (atBottom()) {
    readFrac.value = 1;
    return;
  }
  const start = spies[index]!.top;
  const end = spies[index + 1]?.top ?? maxScroll() + SPY_LINE;
  const line = window.scrollY + SPY_LINE;
  readFrac.value = end > start ? Math.min(Math.max((line - start) / (end - start), 0), 1) : 1;
}

function updateActive() {
  if (!spies.length) return;
  if (!locked.value) {
    const line = window.scrollY + SPY_LINE;
    let picked: (typeof spies)[number] | undefined = spies[0];
    if (atBottom()) {
      picked = spies.at(-1);
    } else {
      for (const spy of spies) {
        if (spy.top > line) break;
        picked = spy;
      }
    }
    activeId.value = picked?.id ?? "";
  }
  updateProgress();
}

let frame = 0;
function schedule(remeasure = false) {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    if (remeasure) measure();
    updateActive();
  });
}

const onScroll = () => schedule();
const onResize = () => {
  measure();
  measureTruncation();
  measureRail();
  updateActive();
};

let bodyObserver: ResizeObserver | undefined;

function setupSpy() {
  if (typeof window === "undefined") return;
  measure();
  updateActive();
}

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  lockSpy();
  activeId.value = id;
  window.scrollTo({ top, behavior: "smooth" });
  history.replaceState(null, "", `#${id}`);
}

onMounted(() =>
  nextTick(() => {
    setupSpy();
    measureTruncation();
    measureRail();
    requestAnimationFrame(() => {
      animated.value = true;
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    if ("onscrollend" in window) window.addEventListener("scrollend", unlock);
    if (props.highlight && typeof ResizeObserver !== "undefined") {
      bodyObserver = new ResizeObserver(() => schedule(true));
      bodyObserver.observe(document.body);
    }
  }),
);

onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("resize", onResize);
  window.removeEventListener("scrollend", unlock);
  bodyObserver?.disconnect();
  if (frame) cancelAnimationFrame(frame);
  clearTimeout(lockTimer);
});

watch(activeId, () => nextTick(measureRail));

watch(
  () => props.links,
  () =>
    nextTick(() => {
      setupSpy();
      measureTruncation();
      measureRail();
    }),
);
</script>

<template>
  <div
    ref="containerEl"
    :class="
      cn(
        'hidden lg:block sticky overflow-y-auto overflow-x-hidden py-8 text-sm',
        hasSubnav
          ? 'top-[calc(7rem+var(--status-banner-height))] max-h-[calc(100vh-7rem-var(--status-banner-height))]'
          : 'top-[calc(4rem+var(--status-banner-height))] max-h-[calc(100vh-4rem-var(--status-banner-height))]',
      )
    "
  >
    <p v-if="title" class="mb-3 font-semibold text-foreground">{{ title }}</p>

    <nav ref="navEl" class="relative">
      <span
        v-if="activeBox"
        aria-hidden="true"
        :class="cn('toc-progress', locked && 'toc-progress--seeking')"
        :style="{ transform: `scaleY(${progress})` }"
      />

      <ul class="relative border-l border-border">
        <li v-for="(link, index) in flatLinks" :key="link.id">
          <Tooltip :text="link.text" side="left" :disabled="!truncated.has(link.id)">
            <a
              :ref="(el) => setLinkEl(link.id, el)"
              :href="`#${link.id}`"
              :aria-current="activeId === link.id ? 'location' : undefined"
              :style="{
                paddingLeft: `${(Math.max(link.depth, 2) - 2) * 0.75 + 0.75}rem`,
                '--dist': lensDepth(index),
              }"
              :class="
                cn(
                  'toc-link -ml-px mr-3 block truncate border-l border-transparent py-1 pr-2 leading-snug',
                  activeId === link.id && 'font-medium',
                )
              "
              @click.prevent="scrollTo(link.id)"
            >
              {{ link.text }}
            </a>
          </Tooltip>
        </li>
      </ul>
    </nav>
  </div>
</template>

<style scoped>
/* Keep the divisor aligned with LENS_REACH; `--d` lets hover override inline `--dist`. */
.toc-link {
  --d: var(--dist, 2);
  --focus: clamp(0, calc(1 - var(--d) / 3), 1);

  transform-origin: left center;
  transform: scale(calc(1 + 0.07 * var(--focus)));
  color: color-mix(in oklab, var(--foreground) calc(var(--focus) * 100%), var(--muted-foreground));
  opacity: calc(0.78 + 0.22 * var(--focus));
  transition:
    transform 300ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 300ms ease,
    color 200ms ease;
}

.toc-link:hover,
.toc-link:focus-visible {
  --d: 0;
}

/* Per-frame progress uses transform to stay off the layout path. */
.toc-progress {
  position: absolute;
  inset-block: 0;
  left: -1px;
  width: 2px;
  transform-origin: top;
  pointer-events: none;
  will-change: transform;
  background: var(--foreground);
}

.toc-progress--seeking {
  transition: transform 300ms cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  .toc-link,
  .toc-progress--seeking {
    transition: none;
  }

  .toc-link {
    transform: none;
  }
}
</style>
