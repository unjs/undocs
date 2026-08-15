<script setup lang="ts">
/**
 * "On this page" — the right-hand table of contents, with a focus LENS.
 *
 * Two things here are deliberate.
 *
 * **Scroll-spy reads the scroll position, not an IntersectionObserver.** The
 * previous version observed every heading with a `-80px 0px -70% 0px` root
 * margin and took the topmost one currently inside that band. That band is a
 * ~30vh strip, so a section longer than it puts NO heading inside — the set
 * goes empty, nothing is picked, and the highlight stays stuck on whatever was
 * last seen (usually the heading you already scrolled past). Short sections do
 * the opposite and put three headings in the strip at once. Here `updateActive`
 * asks the only question that actually matters — which heading did the reading
 * line (`SPY_LINE`, just under the sticky header) last cross — by comparing
 * cached document offsets, so there is always exactly one answer. The two ends
 * are special-cased because the line can never answer them: above the first
 * heading it picks the first, and at the document bottom it picks the last
 * (trailing sections are shorter than the viewport, so they never reach the
 * line at all).
 *
 * Offsets are cached (`measure`) rather than re-read per frame — a scroll
 * handler that calls `getBoundingClientRect()` on every heading forces a layout
 * each frame. A `ResizeObserver` on `<body>` re-measures when late images,
 * fonts or a toggled section change the page height.
 *
 * **The highlight is a proximity lens, not a single row.** Every link carries
 * `--dist`, its distance in list positions from the active one; the scoped CSS
 * turns that into opacity and a small scale, so focus falls off over
 * `LENS_REACH` items instead of snapping between two states. Hovering re-centres
 * the lens on the pointer.
 *
 * **The rail mark is READING PROGRESS, not a thumb.** One absolutely-positioned
 * bar (`.toc-progress`) fills the rail from the top of the list down to the
 * reading line, so the ToC doubles as a progress meter for the page. Its leading
 * edge is `readFrac` of the way down the ACTIVE row, and since a section hands
 * over to the next exactly when its fraction reaches 1 — and the rows are
 * contiguous — the edge never jumps at a boundary, it just keeps sliding. It is
 * drawn as a full-height bar under `scaleY()` rather than an animated `height`,
 * so a value that changes every scroll frame stays off the layout path (same
 * reason the heading offsets are cached below).
 *
 * The lens is MONOCHROME and unfilled: focus is carried by size, weight and
 * contrast alone — no accent tint, no wash behind the row. The only mark is the
 * `--foreground` fill on the rail. That keeps `--brand` for links and nav, and
 * it keeps the ToC from competing with the page it indexes.
 *
 * The column is `overflow-x-hidden` (its `overflow-y-auto` alone would compute
 * to `auto` on BOTH axes) so a magnified row cannot raise a horizontal
 * scrollbar; `mr-3` on each link leaves that row room to grow into rather than
 * be clipped. The tooltip is portalled, so it is not clipped either.
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

/** Sticky-header offset for in-page anchor scrolling (matches `MarkdownRenderer`). */
const HEADER_OFFSET = 80;
/** The reading line: a heading counts as current once it passes just under the header. */
const SPY_LINE = HEADER_OFFSET + 24;
/** How far, in list positions, the lens still lights an item. Mirrored in the CSS below. */
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

/**
 * Distance from the lens centre. With nothing active (SSR, and the client's
 * first render) every item sits at the same middling distance, so the two
 * renders agree — see the hydration-parity invariant.
 */
function lensDepth(index: number): number {
  const active = activeIndex.value;
  return Math.min(active < 0 ? 2 : Math.abs(index - active), LENS_REACH);
}

const containerEl = ref<HTMLElement>();
const navEl = ref<HTMLElement>();

// Track which links overflow their box so the tooltip only shows for clipped
// (truncated with "…") items.
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

/** Layout box of the active row inside `nav`, and the rail's own full height. */
const activeBox = ref<{ top: number; height: number }>();
const navHeight = ref(0);
/** How far the reading line has travelled through the ACTIVE section, 0..1. */
const readFrac = ref(0);
/** Off for the first paint, so the ToC does not scroll itself on arrival. */
const animated = ref(false);

/** The fill, as a fraction of the rail — `scaleY()` for the bar below. */
const progress = computed(() => {
  const box = activeBox.value;
  if (!box || !navHeight.value) return 0;
  return Math.min((box.top + box.height * readFrac.value) / navHeight.value, 1);
});

/**
 * Layout offset of `el` inside `ancestor`, walking the `offsetParent` chain —
 * `offsetTop` alone is relative to the nearest POSITIONED ancestor, which is a
 * moving target here. Layout coordinates, not rects, because the active link
 * carries a `scale()` and its rect is the scaled box: measuring that would make
 * the fill's leading edge wobble by a couple of pixels on every hand-over.
 */
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

/**
 * Keep the active row inside the (independently scrollable) ToC column. Done by
 * hand rather than with `scrollIntoView({ block: "nearest" })`, which is free to
 * scroll ancestors too — i.e. to yank the page out from under the reader.
 */
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

/** Heading elements with their cached document offsets, in document order. */
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

/**
 * Clicking a link scrolls smoothly, which fires dozens of scroll events on the
 * way — every one of them naming a heading the reader is only passing through.
 * The pick is locked until the scroll settles.
 */
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

/** Max scroll offset, i.e. the position at which the document bottom is shown. */
function maxScroll(): number {
  return document.documentElement.scrollHeight - window.innerHeight;
}

function atBottom(): boolean {
  return window.scrollY >= maxScroll() - 32;
}

/**
 * How far the reading line has moved from the active heading toward the next
 * one. The LAST section has no next heading, so it runs to the bottom of the
 * document instead — which is what lets the fill actually reach 100%.
 */
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
    // Only scroll the column to the active row smoothly once it has been placed.
    requestAnimationFrame(() => {
      animated.value = true;
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    if ("onscrollend" in window) window.addEventListener("scrollend", unlock);
    if (props.highlight && typeof ResizeObserver !== "undefined") {
      // Late images, fonts and toggled sections move every heading below them.
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
                  // No text-colour utility here: colour is the lens ramp, mixed
                  // per item in the scoped CSS from `--focus`.
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
/* `--dist` (set per link, inline) is the distance in list positions from the
   active item; `--focus` is that inverted and clamped into 0..1 over LENS_REACH
   items — keep the divisor in step with `LENS_REACH` above. The hop through
   `--d` is what lets the hover rule below re-centre the lens: an INLINE
   `--d` would out-rank every selector, and `:hover` could never override it. */
.toc-link {
  --d: var(--dist, 2);
  --focus: clamp(0, calc(1 - var(--d) / 3), 1);

  transform-origin: left center;
  /* LINEAR in `--focus`, so the neighbours visibly participate: 1.07 / 1.047 /
     1.023 / 1 across the reach. An eased (squared) ramp puts ~80% of the
     magnification on the active row alone and the lens stops reading as one. */
  transform: scale(calc(1 + 0.07 * var(--focus)));
  /* The contrast ramp is the other half of the lens, and it is CONTINUOUS —
     mixed per item rather than switched between two utility classes, so nothing
     steps. Monochrome: the whole range is foreground..muted-foreground. */
  color: color-mix(in oklab, var(--foreground) calc(var(--focus) * 100%), var(--muted-foreground));
  opacity: calc(0.78 + 0.22 * var(--focus));
  transition:
    transform 300ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 300ms ease,
    color 200ms ease;
}

/* The pointer is a second lens. */
.toc-link:hover,
.toc-link:focus-visible {
  --d: 0;
}

/* Sits ON the rail the `<ul>` draws, straddling it like the links' own -ml-px.
   Full height, scaled from the top: the scroll handler writes `scaleY()` every
   frame, and a transform is the only way to do that without a layout pass. No
   transition by default for the same reason — the value is already continuous,
   and easing it would just make the fill lag the page. */
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

/* The one discontinuity: clicking a link pins the active row to the target
   before the smooth scroll gets there, so the fill would teleport. Ease it only
   while that lock is held. */
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
