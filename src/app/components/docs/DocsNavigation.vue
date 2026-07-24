<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "@app/router";
import { cn } from "@app/utils/cn";
import DocsNavigation from "@app/components/docs/DocsNavigation.vue";
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink";
import Tooltip from "@app/components/ui/Tooltip.vue";
// Based on Nuxt UI `UContentNavigation` component. Recursive, collapsible navigation tree.
//
// Props:
//   - navigation   NavItem[] to render at this level
//   - default-open when true, groups start expanded
//   - multiple     when false, opening a group closes its siblings (accordion)
//   - collapsible  when false, groups are always expanded (no toggle) — used by
//                  the docs sidebar; group headers become links when navigable
//   - level        internal recursion depth (indents nested levels)
//
// Active link = exact route path match → `bg-muted text-primary`.
import type { NavItem } from "../../server/content/types";

const props = withDefaults(
  defineProps<{
    navigation: NavItem[];
    defaultOpen?: boolean;
    multiple?: boolean;
    collapsible?: boolean;
    level?: number;
  }>(),
  {
    defaultOpen: false,
    multiple: true,
    collapsible: true,
    level: 0,
  },
);

const route = useRoute();

const isActive = (item: NavItem) => route.path === item.path || route.path === `${item.path}/`;

const containsActive = (item: NavItem): boolean =>
  isActive(item) || (item.children?.some(containsActive) ?? false);

// Explicit open/closed overrides keyed by path; falls back to the default rule.
const openState = reactive<Record<string, boolean>>({});

const isOpen = (item: NavItem): boolean => {
  if (props.collapsible === false) return true;
  if (item.path in openState) return openState[item.path];
  return props.defaultOpen || containsActive(item);
};

const toggle = (item: NavItem) => {
  if (props.collapsible === false) return;
  const next = !isOpen(item);
  if (next && !props.multiple) {
    for (const key in openState) openState[key] = false;
  }
  openState[item.path] = next;
};

const hasChildren = (item: NavItem) => !!item.children?.length;

// A group with its OWN index page (`index.md`) emits a "self-index" child whose
// path equals the group's path. In the non-collapsible sidebar we fold it into
// the header — the header becomes the link to that index and the duplicate child
// is dropped. In collapsible mode (mobile slideover) the header is a toggle, so
// the index child is left in place to remain reachable.
//
// A group WITHOUT an index page has `page === false`: its path was synthesized
// from its first child (`builder.ts` sets `path = children[0].path`), so a child
// shares the group's path but is a REAL page, not a self-index — it must stay
// visible, not be folded away.
const indexChild = (item: NavItem) =>
  item.page !== false ? item.children?.find((c) => c.path === item.path) : undefined;

// Path the static (non-collapsible) group header should link to, or undefined
// when the group isn't itself navigable.
const headerLink = (item: NavItem): string | undefined =>
  item.page !== false ? item.path : indexChild(item)?.path;

const renderedChildren = (item: NavItem): NavItem[] => {
  const children = item.children ?? [];
  // Drop the folded self-index child only when there is one (page groups); an
  // index-less group keeps every child, including the one sharing its path.
  if (props.collapsible === false && indexChild(item)) {
    return children.filter((c) => c.path !== item.path);
  }
  return children;
};

// Track which title spans overflow their box so the tooltip only shows for
// clipped (truncated with "…") items. Per component instance (recursive tree).
const linkEls = new Map<string, HTMLElement>();
const truncated = ref<Set<string>>(new Set());

function setLinkEl(path: string, el: unknown) {
  if (el instanceof HTMLElement) linkEls.set(path, el);
  else linkEls.delete(path);
}

function measureTruncation() {
  const next = new Set<string>();
  for (const [path, el] of linkEls) {
    if (el.scrollWidth > el.clientWidth) next.add(path);
  }
  truncated.value = next;
}

onMounted(() =>
  nextTick(() => {
    measureTruncation();
    window.addEventListener("resize", measureTruncation);
  }),
);
onBeforeUnmount(() => window.removeEventListener("resize", measureTruncation));
watch(
  () => props.navigation,
  () => nextTick(measureTruncation),
);
</script>

<template>
  <ul
    :class="cn('flex flex-col gap-0.5', level > 0 && 'mt-0.5 ml-2.5 border-l border-border pl-2.5')"
  >
    <li v-for="item in navigation" :key="item.path">
      <!-- Group (has children) -->
      <template v-if="hasChildren(item)">
        <!-- Collapsible: toggle button -->
        <button
          v-if="collapsible !== false"
          type="button"
          :aria-expanded="isOpen(item)"
          class="w-full flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          @click="toggle(item)"
        >
          <Icon v-if="item.icon" :name="item.icon" class="size-4 shrink-0 text-muted-foreground" />
          <Tooltip :text="item.title" side="right" :disabled="!truncated.has(item.path)">
            <span :ref="(el) => setLinkEl(item.path, el)" class="min-w-0 truncate text-left">
              {{ item.title }}
            </span>
          </Tooltip>
          <Icon
            name="i-lucide-chevron-right"
            :class="
              cn(
                'ml-auto size-4 shrink-0 text-muted-foreground transition-transform',
                isOpen(item) && 'rotate-90',
              )
            "
          />
        </button>

        <!-- Non-collapsible: static header (link when navigable) -->
        <AppLink
          v-else-if="headerLink(item)"
          :to="headerLink(item)"
          :class="
            cn(
              'flex items-center gap-1.5 px-2 py-1.5 text-sm font-semibold transition-colors',
              isActive(item) ? 'text-primary' : 'text-foreground hover:text-primary',
            )
          "
        >
          <Icon v-if="item.icon" :name="item.icon" class="size-4 shrink-0 text-muted-foreground" />
          <Tooltip :text="item.title" side="right" :disabled="!truncated.has(item.path)">
            <span :ref="(el) => setLinkEl(item.path, el)" class="min-w-0 truncate">
              {{ item.title }}
            </span>
          </Tooltip>
        </AppLink>
        <div
          v-else
          class="flex items-center gap-1.5 px-2 py-1.5 text-sm font-semibold text-foreground"
        >
          <Icon v-if="item.icon" :name="item.icon" class="size-4 shrink-0 text-muted-foreground" />
          <Tooltip :text="item.title" side="right" :disabled="!truncated.has(item.path)">
            <span :ref="(el) => setLinkEl(item.path, el)" class="min-w-0 truncate">
              {{ item.title }}
            </span>
          </Tooltip>
        </div>

        <Transition
          enter-active-class="overflow-hidden transition-all duration-200 ease-out"
          leave-active-class="overflow-hidden transition-all duration-200 ease-in"
          enter-from-class="opacity-0 -translate-y-1"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <DocsNavigation
            v-show="isOpen(item)"
            :navigation="renderedChildren(item)"
            :default-open="defaultOpen"
            :multiple="multiple"
            :collapsible="collapsible"
            :level="level + 1"
          />
        </Transition>
      </template>

      <!-- Leaf link -->
      <AppLink
        v-else
        :to="item.path"
        :data-active-docs-link="isActive(item) ? '' : undefined"
        :class="
          cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors',
            isActive(item)
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
          )
        "
      >
        <Icon v-if="item.icon" :name="item.icon" class="size-4 shrink-0" />
        <Tooltip :text="item.title" side="right" :disabled="!truncated.has(item.path)">
          <span :ref="(el) => setLinkEl(item.path, el)" class="min-w-0 truncate">
            {{ item.title }}
          </span>
        </Tooltip>
      </AppLink>
    </li>
  </ul>
</template>
