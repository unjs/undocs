<script setup lang="ts">
import Icon from "@app/components/global/Icon.vue";
// Markdown tab and labeled div children expose the same vnode prop shape.
import { computed, Fragment, ref, useSlots, type VNode } from "vue";

const slots = useSlots();

const items = computed<VNode[]>(() => {
  const raw = slots.default?.() ?? [];
  const out: VNode[] = [];
  const walk = (nodes: unknown[]) => {
    if (!Array.isArray(nodes)) return;
    for (const n of nodes) {
      if (n == null || typeof n === "boolean") continue;
      const vnode = n as VNode;
      if (vnode.type === Fragment && Array.isArray(vnode.children)) {
        walk(vnode.children as unknown[]);
        continue;
      }
      if (typeof vnode.type === "symbol") continue;
      out.push(vnode);
    }
  };
  walk(Array.isArray(raw) ? raw : [raw]);
  return out;
});

const active = ref(0);

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
  <div class="tabs my-4 overflow-hidden rounded-lg border border-border">
    <div
      v-if="tabs.length"
      class="flex flex-wrap items-center gap-1 border-b border-border bg-card px-2 py-1.5"
    >
      <button
        v-for="(tab, i) in tabs"
        :key="i"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition"
        :class="
          i === activeIndex
            ? 'bg-background text-foreground shadow-small'
            : 'text-muted-foreground hover:text-foreground'
        "
        @click="active = i"
      >
        <Icon v-if="tab.icon" :name="tab.icon" class="size-4 shrink-0" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Keep panels mounted so their state survives tab switches. -->
    <div v-if="items.length" class="tabs-body px-4 py-2">
      <div v-for="(vnode, i) in items" v-show="i === activeIndex" :key="i">
        <component :is="vnode" />
      </div>
    </div>
  </div>
</template>
