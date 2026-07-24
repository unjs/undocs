<script setup lang="ts">
import Icon from "@app/components/global/Icon.vue";
/**
 * Tabs
 * ----
 * Renders a tab bar from its child vnodes and shows only the active panel.
 *
 * Children come from the markdown renderer and may be authored either as
 * `:::tab{label="…"}` (resolves to the `<Tab>` component) or as `::div` blocks
 * carrying `label`/`icon` props. In both cases the label lives on the child
 * vnode's `props`, so we read it the same way regardless of the child's type.
 *
 * Mirrors the sibling `ProseCodeGroup.vue`: flatten the default slot, read a
 * label off each child, toggle the active index with a `ref`, and render the
 * active child by `<component :is>`.
 */
import { computed, Fragment, ref, useSlots, type VNode } from "vue";

const slots = useSlots();

/** Flatten the default slot into a flat list of element/component vnodes. */
const items = computed<VNode[]>(() => {
  const raw = slots.default?.() ?? [];
  const out: VNode[] = [];
  const walk = (nodes: unknown[]) => {
    if (!Array.isArray(nodes)) return;
    for (const n of nodes) {
      if (n == null || typeof n === "boolean") continue;
      const vnode = n as VNode;
      // Unwrap fragments (e.g. produced by v-for) into their children.
      if (vnode.type === Fragment && Array.isArray(vnode.children)) {
        walk(vnode.children as unknown[]);
        continue;
      }
      // Skip bare text/comment nodes between prose blocks.
      if (typeof vnode.type === "symbol") continue;
      out.push(vnode);
    }
  };
  walk(Array.isArray(raw) ? raw : [raw]);
  return out;
});

const active = ref(0);

/** Keep the active index in range if the child list ever shrinks. */
const activeIndex = computed(() =>
  items.value.length ? Math.min(active.value, items.value.length - 1) : 0,
);

interface TabMeta {
  label: string;
  icon?: string;
}

const tabs = computed<TabMeta[]>(() =>
  items.value.map((vnode, i) => {
    const props = (vnode.props ?? {}) as Record<string, unknown>;
    const label = (props.label as string) || (props.title as string) || `Tab ${i + 1}`;
    return { label, icon: props.icon as string | undefined };
  }),
);
</script>

<template>
  <div class="tabs my-4 overflow-hidden rounded-lg border border-[var(--ui-border)]">
    <!-- Tab bar -->
    <div
      v-if="tabs.length"
      class="flex flex-wrap items-center gap-1 border-b border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] px-2 py-1.5"
    >
      <button
        v-for="(tab, i) in tabs"
        :key="i"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition"
        :class="
          i === activeIndex
            ? 'bg-[var(--ui-bg)] text-[var(--ui-text)] shadow-sm'
            : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
        "
        @click="active = i"
      >
        <Icon v-if="tab.icon" :name="tab.icon" class="size-4 shrink-0" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Panels: render all, show only the active one so state is preserved. -->
    <div v-if="items.length" class="tabs-body px-4 py-2">
      <div v-for="(vnode, i) in items" v-show="i === activeIndex" :key="i">
        <component :is="vnode" />
      </div>
    </div>
  </div>
</template>
