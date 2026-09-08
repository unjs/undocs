<script setup lang="ts">
// Selection and expansion are deterministic in setup for hydration parity.
import { cloneVNode, computed, Fragment, ref, useSlots, type VNode } from "vue";
import Icon from "@app/components/global/Icon.vue";
import Button from "@app/components/ui/Button.vue";
import { useCodeIcon } from "@app/composables/useCodeIcon.ts";

const props = defineProps<{
  defaultValue?: string;
  expandAll?: boolean;
}>();

const slots = useSlots();
const resolveCodeIcon = useCodeIcon();

const items = computed<VNode[]>(() => {
  const raw = slots.default?.() ?? [];
  const out: VNode[] = [];
  const walk = (nodes: unknown[]) => {
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

interface FileMeta {
  path: string;
  icon: string;
  vnode: VNode;
}

const files = computed<FileMeta[]>(() =>
  items.value.map((vnode, i) => {
    const filename = (vnode.props?.filename as string | undefined) || `Code ${i + 1}`;
    return {
      path: filename,
      icon: resolveCodeIcon(filename, vnode.props?.language, vnode.props?.icon),
      vnode,
    };
  }),
);

// Deterministic sorting keeps SSR and hydration row order aligned.
type TreeFile = { type: "file"; name: string; path: string };
type TreeFolder = { type: "folder"; name: string; path: string; children: TreeNode[] };
type TreeNode = TreeFile | TreeFolder;

const tree = computed<TreeNode[]>(() => {
  const root: TreeNode[] = [];
  for (const file of files.value) {
    const segments = file.path.split("/").filter(Boolean);
    let level = root;
    let prefix = "";
    segments.forEach((name, depth) => {
      prefix = prefix ? `${prefix}/${name}` : name;
      if (depth === segments.length - 1) {
        level.push({ type: "file", name, path: file.path });
        return;
      }
      let folder = level.find((n): n is TreeFolder => n.type === "folder" && n.path === prefix);
      if (!folder) {
        folder = { type: "folder", name, path: prefix, children: [] };
        level.push(folder);
      }
      level = folder.children;
    });
  }
  const sort = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) if (n.type === "folder") sort(n.children);
    return nodes;
  };
  return sort(root);
});

// Keep slot access lazy so it occurs during render, not setup.
const firstPath = computed(() => files.value[0]?.path ?? "");
const defaultSelected = computed(() =>
  props.defaultValue && files.value.some((f) => f.path === props.defaultValue)
    ? props.defaultValue
    : firstPath.value,
);
const selectedOverride = ref<string | null>(null);
const drawerOpen = ref(false);
const selected = computed(() =>
  selectedOverride.value && files.value.some((f) => f.path === selectedOverride.value)
    ? selectedOverride.value
    : defaultSelected.value,
);

const selectedFile = computed<FileMeta | undefined>(
  () => files.value.find((f) => f.path === selected.value) ?? files.value[0],
);

const selectedVNode = computed<VNode | null>(() =>
  selectedFile.value ? cloneVNode(selectedFile.value.vnode, { filename: null }) : null,
);

const expandedDefault = computed<Record<string, boolean>>(() => {
  const state: Record<string, boolean> = {};
  if (props.expandAll) {
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.type === "folder") {
          state[n.path] = true;
          walk(n.children);
        }
      }
    };
    walk(tree.value);
  } else {
    const segments = defaultSelected.value.split("/").filter(Boolean);
    let prefix = "";
    for (let i = 0; i < segments.length - 1; i++) {
      prefix = prefix ? `${prefix}/${segments[i]}` : segments[i];
      state[prefix] = true;
    }
  }
  return state;
});
const expandedOverride = ref<Record<string, boolean>>({});
const expanded = computed<Record<string, boolean>>(() => ({
  ...expandedDefault.value,
  ...expandedOverride.value,
}));

function toggle(path: string) {
  expandedOverride.value = { ...expandedOverride.value, [path]: !expanded.value[path] };
}

function fileIcon(path: string): string {
  return files.value.find((f) => f.path === path)?.icon ?? "i-lucide-file";
}

interface Row {
  node: TreeNode;
  depth: number;
}
const rows = computed<Row[]>(() => {
  const out: Row[] = [];
  const walk = (nodes: TreeNode[], depth: number) => {
    for (const node of nodes) {
      out.push({ node, depth });
      if (node.type === "folder" && expanded.value[node.path]) {
        walk(node.children, depth + 1);
      }
    }
  };
  walk(tree.value, 0);
  return out;
});
</script>

<template>
  <div
    class="code-tree my-4 flex max-h-96 overflow-hidden rounded-lg border border-border bg-card min-h-36 relative @container/code-tree"
  >
    <!-- Backdrop when drawer opens -->
    <div
      class="hidden cursor-pointer @max-xl/code-tree:absolute @max-xl/code-tree:inset-0 @max-xl/code-tree:z-20 @max-xl/code-tree:block @max-xl/code-tree:bg-black/40 @max-xl/code-tree:transition-opacity @max-xl/code-tree:duration-200"
      :class="
        drawerOpen
          ? '@max-xl/code-tree:opacity-100 @max-xl/code-tree:pointer-events-auto'
          : '@max-xl/code-tree:opacity-0 @max-xl/code-tree:pointer-events-none'
      "
      :aria-hidden="!drawerOpen"
      @click="drawerOpen = false"
    />

    <!-- Toggleable file tree -->
    <div
      class="w-56 shrink-0 overflow-y-auto border-r border-border bg-muted/40 py-2 text-sm @max-xl/code-tree:absolute @max-xl/code-tree:inset-y-0 @max-xl/code-tree:left-0 @max-xl/code-tree:z-30 @max-xl/code-tree:w-[min(75%,14rem)] @max-xl/code-tree:bg-card @max-xl/code-tree:shadow-menu @max-xl/code-tree:transition-transform @max-xl/code-tree:duration-200"
      :class="
        drawerOpen ? '@max-xl/code-tree:translate-x-0' : '@max-xl/code-tree:-translate-x-full'
      "
    >
      <div
        v-for="({ node, depth }, i) in rows"
        :key="i"
        class="flex cursor-pointer items-center gap-1.5 px-2 py-1 transition"
        :class="
          node.type === 'file' && node.path === selected
            ? 'bg-brand/10 text-brand'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        "
        :style="{ paddingLeft: `${0.5 + depth * 0.75}rem` }"
        @click="
          node.type === 'folder'
            ? toggle(node.path)
            : ((selectedOverride = node.path), (drawerOpen = false))
        "
      >
        <template v-if="node.type === 'folder'">
          <Icon
            name="i-lucide-chevron-right"
            class="size-3.5 shrink-0 transition-transform"
            :class="expanded[node.path] ? 'rotate-90' : ''"
          />
          <Icon
            :name="expanded[node.path] ? 'i-lucide-folder-open' : 'i-lucide-folder'"
            class="size-4 shrink-0 text-muted-foreground"
          />
        </template>
        <template v-else>
          <span class="size-3.5 shrink-0" />
          <Icon :name="fileIcon(node.path)" class="size-4 shrink-0" />
        </template>
        <span class="truncate">{{ node.name }}</span>
      </div>
    </div>

    <!-- The selected pre owns scrolling and stretches through the flex chain. -->
    <div class="code-tree-body flex min-h-0 min-w-0 flex-1 flex-col">
      <!-- File tree toggle -->
      <div
        class="hidden @max-xl/code-tree:relative @max-xl/code-tree:flex @max-xl/code-tree:items-center @max-xl/code-tree:gap-2 @max-xl/code-tree:border-b @max-xl/code-tree:border-border @max-xl/code-tree:px-3 @max-xl/code-tree:py-2 @max-xl/code-tree:text-foreground @max-xl/code-tree:bg-card @max-xl/code-tree:transition-colors @max-xl/code-tree:hover:bg-muted"
      >
        <Icon name="i-lucide-folder-tree" class="size-4 shrink-0" />

        <!-- Vertical separator -->
        <span class="h-full w-0.5 rounded-full bg-border" aria-hidden="true"></span>

        <span class="text-sm">{{ selectedFile?.path }}</span>

        <Button
          type="button"
          class="absolute inset-0 opacity-0 cursor-pointer"
          :aria-label="drawerOpen ? 'Close file tree' : 'Open file tree'"
          :aria-expanded="drawerOpen"
          @click="drawerOpen = !drawerOpen"
        />
      </div>

      <component :is="selectedVNode" v-if="selectedVNode" />
    </div>
  </div>
</template>

<style scoped>
/* Flatten ProsePre's frame and stretch it to the tree row. */
.code-tree-body :deep(.prose-pre) {
  margin: 0;
  border: 0;
  border-radius: 0;
  display: flex;
  flex: 1 1 0%;
  min-height: 0;
  height: 100%;
  flex-direction: column;
}

/* The capped code body owns overflow. */
.code-tree-body :deep(.code-hl-wrapper),
.code-tree-body :deep(.prose-pre > pre) {
  flex: 1 1 0%;
  min-height: 0;
  overflow: auto;
}

/* Soft-wrap long lines while retaining overflow for unbreakable tokens. */
.code-tree-body :deep(.code-hl),
.code-tree-body :deep(.prose-pre > pre) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
