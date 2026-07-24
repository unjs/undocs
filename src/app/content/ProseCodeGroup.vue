<script setup lang="ts">
import { cloneVNode, computed, Fragment, ref, useSlots, type VNode } from "vue";
import Icon from "@app/components/global/Icon.vue";
import { useCodeIcon } from "@app/composables/useCodeIcon";

defineProps<{
  /** Sync group key (accepted for compatibility; not persisted in MVP). */
  sync?: string;
}>();

const slots = useSlots();
const resolveCodeIcon = useCodeIcon();

/** Flatten the default slot into a flat list of child vnodes. */
const items = computed<VNode[]>(() => {
  const raw = slots.default?.() ?? [];
  const out: VNode[] = [];
  const walk = (nodes: unknown[]) => {
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

const tabs = computed(() =>
  items.value.map((vnode, i) => {
    const filename = vnode.props?.filename as string | undefined;
    return {
      label: filename || `Code ${i + 1}`,
      // Only resolve an icon for tabs that carry a filename; unnamed blocks
      // (`Code N`) stay label-only.
      icon: filename
        ? resolveCodeIcon(filename, vnode.props?.language, vnode.props?.icon)
        : undefined,
    };
  }),
);

/** The active child, with its `filename` stripped (tabs already show it). */
const activeVNode = computed<VNode | null>(() => {
  const vnode = items.value[active.value];
  if (!vnode) return null;
  return cloneVNode(vnode, { filename: null });
});
</script>

<template>
  <div class="prose-code-group my-4 overflow-hidden rounded-lg border border-[var(--ui-border)]">
    <!-- Tab bar -->
    <div
      v-if="tabs.length"
      class="flex flex-wrap items-center gap-1 border-b border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] px-2 py-1.5"
    >
      <button
        v-for="(tab, i) in tabs"
        :key="i"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition"
        :class="
          i === active
            ? 'bg-[var(--ui-bg)] text-[var(--ui-text)] shadow-sm'
            : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
        "
        @click="active = i"
      >
        <Icon v-if="tab.icon" :name="tab.icon" class="size-3.5 shrink-0" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Active panel -->
    <div class="code-group-body">
      <component :is="activeVNode" v-if="activeVNode" />
    </div>
  </div>
</template>

<style scoped>
/* Children are ProsePre — drop their own border/rounding/margin inside the group. */
.code-group-body :deep(.prose-pre) {
  margin: 0;
  border: 0;
  border-radius: 0;
}
</style>
