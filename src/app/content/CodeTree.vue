<script setup lang="ts">
/**
 * CodeTree
 * --------
 * A VS-Code-style file browser: a folder/file EXPLORER on the left, the
 * currently-selected file's syntax-highlighted code on the right.
 *
 * Input shape mirrors `ProseCodeGroup` — the default slot is a set of child
 * `ProsePre` code blocks, each carrying a `filename` (path), `language` and
 * `icon` off its props. A `filename` with `/` (e.g. `server/routes/index.ts`)
 * nests into folders. The children are already shiki-highlighted by the content
 * pipeline, so we never run shiki on the client: we just DISPLAY the selected
 * child vnode.
 *
 * Hydration parity: the selected file and the expanded folders are seeded
 * DETERMINISTICALLY in `setup` (from `defaultValue` / `expandAll`, else the
 * first file), so the SSR render and the client's first render are identical.
 * Clicking only mutates refs post-hydration.
 */
import { cloneVNode, computed, Fragment, ref, useSlots, type VNode } from "vue";
import Icon from "@app/components/global/Icon.vue";
import { useCodeIcon } from "@app/composables/useCodeIcon";

const props = defineProps<{
  /** Path of the file selected on first render (falls back to the first file). */
  defaultValue?: string;
  /** Expand every folder on first render (else only the selected file's path). */
  expandAll?: boolean;
}>();

const slots = useSlots();
const resolveCodeIcon = useCodeIcon();

/** Flatten the default slot into a flat list of child (ProsePre) vnodes. */
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

interface FileMeta {
  path: string;
  icon: string;
  vnode: VNode;
}

/** Every file, indexed by its (unique) path. */
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

// --- Nested tree, built from the file paths (split on `/`). Folders sort
// before files; both alphabetically — a deterministic order independent of
// authoring order (matters for hydration parity of the flattened row list). ---
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

// --- Selected file: `defaultValue` when it names a real file, else the first.
// The default is derived lazily (a computed) so the default slot is invoked
// during render, not during setup — a click stores an override that wins. ---
const firstPath = computed(() => files.value[0]?.path ?? "");
const defaultSelected = computed(() =>
  props.defaultValue && files.value.some((f) => f.path === props.defaultValue)
    ? props.defaultValue
    : firstPath.value,
);
const selectedOverride = ref<string | null>(null);
const selected = computed(() =>
  selectedOverride.value && files.value.some((f) => f.path === selectedOverride.value)
    ? selectedOverride.value
    : defaultSelected.value,
);

const selectedFile = computed<FileMeta | undefined>(
  () => files.value.find((f) => f.path === selected.value) ?? files.value[0],
);

/** The selected child, with its `filename` stripped (the tree shows it). */
const selectedVNode = computed<VNode | null>(() =>
  selectedFile.value ? cloneVNode(selectedFile.value.vnode, { filename: null }) : null,
);

// --- Expanded folders (deterministic seed). With `expandAll`, every folder;
// otherwise only the folders on the path to the initially-selected file. Like
// the selection, the seed is a computed (no slot access in setup); a toggle
// stores an override layered on top. ---
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

/** Resolve the language/filename icon for a file row. */
function fileIcon(path: string): string {
  return files.value.find((f) => f.path === path)?.icon ?? "i-lucide-file";
}

/** Flatten the tree into visible rows (children of collapsed folders hidden). */
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
  <div class="code-tree my-4 flex max-h-96 overflow-hidden rounded-lg border border-border bg-card">
    <!-- Explorer -->
    <div class="w-56 shrink-0 overflow-y-auto border-r border-border bg-muted/40 py-2 text-sm">
      <div
        v-for="({ node, depth }, i) in rows"
        :key="i"
        class="flex cursor-pointer items-center gap-1.5 px-2 py-1 transition"
        :class="
          node.type === 'file' && node.path === selected
            ? 'bg-muted text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        "
        :style="{ paddingLeft: `${0.5 + depth * 0.75}rem` }"
        @click="node.type === 'folder' ? toggle(node.path) : (selectedOverride = node.path)"
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

    <!-- Code panel: the selected file's already-highlighted content. Stretches
         to the row height (matching the tree) via an unbroken flex-column chain
         down to the <pre>, which owns the scroll. -->
    <div class="code-tree-body flex min-h-0 min-w-0 flex-1 flex-col">
      <component :is="selectedVNode" v-if="selectedVNode" />
    </div>
  </div>
</template>

<style scoped>
/*
 * The panel child is a ProsePre — drop its own border/rounding/margin, and make
 * it fill the row height so the code side always matches the (possibly taller)
 * file tree. The chain: row (items-stretch) → this panel (flex col) → .prose-pre
 * (flex col, grows) → its body (grows, min-height:0, owns the scroll).
 */
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

/*
 * The highlighted body (or plain-code fallback) grows within the capped row
 * (`.code-tree` max-h-96) and owns the vertical scroll; horizontal scroll stays
 * as a fallback for unbreakable tokens (see word-wrap below).
 */
.code-tree-body :deep(.shiki-wrapper),
.code-tree-body :deep(.prose-pre > pre) {
  flex: 1 1 0%;
  min-height: 0;
  overflow: auto;
}

/*
 * Soft-wrap long lines so a wide file doesn't blow out the panel width;
 * `pre-wrap` preserves indentation, `overflow-wrap: anywhere` breaks long
 * unbreakable tokens, and the containers above keep `overflow-x: auto` so a
 * horizontal scrollbar still appears when a token truly cannot wrap.
 */
.code-tree-body :deep(.shiki),
.code-tree-body :deep(.prose-pre > pre) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
