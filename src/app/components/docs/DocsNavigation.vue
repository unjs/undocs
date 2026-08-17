<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "@app/router.ts";
import { cn } from "@app/utils/cn.ts";
import DocsNavigation from "@app/components/docs/DocsNavigation.vue";
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink.ts";
import Tooltip from "@app/components/ui/Tooltip.vue";
// Based on Nuxt UI's `UContentNavigation`.
import type { NavItem } from "../../../server/content/types.ts";

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

// Only groups with their own page have a duplicate self-index child. Index-less
// groups borrow a child's path, so a same-path child there must remain visible.
const indexChild = (item: NavItem) =>
  item.page !== false ? item.children?.find((c) => c.path === item.path) : undefined;

const headerLink = (item: NavItem): string | undefined =>
  item.page !== false ? item.path : indexChild(item)?.path;

const renderedChildren = (item: NavItem): NavItem[] => {
  const children = item.children ?? [];
  if (props.collapsible === false && indexChild(item)) {
    return children.filter((c) => c.path !== item.path);
  }
  return children;
};

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
    :class="
      cn(
        'flex flex-col gap-0.5',
        level === 0 ? '-mx-2' : 'mt-0.5 ml-3 border-l border-border pl-1.5',
      )
    "
  >
    <li v-for="item in navigation" :key="item.path">
      <template v-if="hasChildren(item)">
        <button
          v-if="collapsible !== false"
          type="button"
          :aria-expanded="isOpen(item)"
          class="flex h-(--size-small) w-full items-center gap-2.5 rounded-md px-3 text-copy-14 font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        <AppLink
          v-else-if="headerLink(item)"
          :to="headerLink(item)"
          :class="
            cn(
              'flex h-(--size-small) items-center gap-2.5 rounded-md px-3 text-copy-14 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive(item) ? 'text-brand' : 'text-foreground hover:text-brand',
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
          class="flex h-(--size-small) items-center gap-2.5 px-3 text-copy-14 font-medium text-foreground"
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

      <AppLink
        v-else
        :to="item.path"
        :data-active-docs-link="isActive(item) ? '' : undefined"
        :class="
          cn(
            'flex h-(--size-small) items-center gap-2.5 rounded-md px-3 text-copy-14 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isActive(item)
              ? 'bg-brand/10 text-brand font-medium'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
