<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { cn } from "@app/utils/cn";
import { useSectionTabs } from "@app/composables/useSectionTabs";
import Tooltip from "@app/components/ui/Tooltip.vue";
// Based on Nuxt UI `UContentToc` component. Right-hand "On this page" list with scroll-spy.
//
// Props: `title`, `links` (TocLink[]), `highlight` (enables IntersectionObserver
// scroll-spy). Clicking a link smooth-scrolls to the heading with a sticky-header
// offset. Nested links are indented by `depth`.
import type { TocLink } from "../../server/content/types";

const { visible: hasSubnav } = useSectionTabs();

const props = defineProps<{
  title?: string;
  links: TocLink[];
  highlight?: boolean;
}>();

const HEADER_OFFSET = 80;

function flatten(links: TocLink[] = [], acc: TocLink[] = []): TocLink[] {
  for (const link of links) {
    acc.push(link);
    if (link.children?.length) flatten(link.children, acc);
  }
  return acc;
}

const flatLinks = computed(() => flatten(props.links));
const activeId = ref<string>("");

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

let observer: IntersectionObserver | undefined;
const visible = new Set<string>();

function pickActive() {
  // Choose the first (topmost, document order) currently-visible heading.
  for (const link of flatLinks.value) {
    if (visible.has(link.id)) {
      activeId.value = link.id;
      return;
    }
  }
}

function setupObserver() {
  if (!props.highlight || typeof window === "undefined") return;
  observer?.disconnect();
  visible.clear();

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      pickActive();
    },
    { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
  );

  for (const link of flatLinks.value) {
    const el = document.getElementById(link.id);
    if (el) observer.observe(el);
  }
}

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top, behavior: "smooth" });
  activeId.value = id;
  history.replaceState(null, "", `#${id}`);
}

onMounted(() =>
  nextTick(() => {
    setupObserver();
    measureTruncation();
    window.addEventListener("resize", measureTruncation);
  }),
);
onBeforeUnmount(() => {
  observer?.disconnect();
  window.removeEventListener("resize", measureTruncation);
});
watch(
  () => props.links,
  () =>
    nextTick(() => {
      setupObserver();
      measureTruncation();
    }),
);
</script>

<template>
  <div
    :class="
      cn(
        'hidden lg:block sticky overflow-y-auto py-8 text-sm',
        hasSubnav
          ? 'top-[calc(7rem+var(--status-banner-height))] max-h-[calc(100vh-7rem-var(--status-banner-height))]'
          : 'top-[calc(4rem+var(--status-banner-height))] max-h-[calc(100vh-4rem-var(--status-banner-height))]',
      )
    "
  >
    <p v-if="title" class="mb-3 font-semibold text-foreground">{{ title }}</p>

    <nav>
      <ul class="border-l border-border">
        <li v-for="link in flatLinks" :key="link.id">
          <Tooltip :text="link.text" side="left" :disabled="!truncated.has(link.id)">
            <a
              :ref="(el) => setLinkEl(link.id, el)"
              :href="`#${link.id}`"
              :style="{ paddingLeft: `${(Math.max(link.depth, 2) - 2) * 0.75 + 0.75}rem` }"
              :class="
                cn(
                  '-ml-px block truncate border-l py-1 pr-2 leading-snug transition-colors',
                  activeId === link.id
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
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
