<script setup lang="ts">
/**
 * Icon — the `UIcon` replacement.
 *
 * Wraps `@iconify/vue`'s `<Icon>` and normalizes the name syntaxes used across
 * the codebase (and user docs configs) into Iconify's `collection:name` form.
 * A leading `i-` (the UnoCSS-preset convention) is stripped first, then:
 *
 *   - Colon form:  `simple-icons:markdown` / `i-simple-icons:markdown`
 *                  / `vscode-icons:file-type-node`  -> `collection:name` as-is.
 *   - Dash form:   `i-lucide-arrow-right`   -> `lucide:arrow-right`
 *                  `i-simple-icons-github`  -> `simple-icons:github`
 *     Rule: the FIRST dash separates collection from icon name — EXCEPT for
 *     known multi-word collections (`simple-icons`, `vscode-icons`, ...) whose
 *     own name contains a dash, which are matched by prefix first.
 *
 * All resolve from the Iconify HTTP API at runtime (current behavior). Any
 * multi-word collection not listed below should be written in colon form.
 *
 * `class` is declared as a prop so it can be forwarded explicitly onto the
 * inner icon; any other attrs (style, aria-*, ...) fall through normally.
 */
import { computed, onMounted, ref } from "vue";
import { Icon as IconifyIcon, iconLoaded } from "@iconify/vue";
import { isIconSeeded, registerServerIcon } from "@app/ssr/icons";

// Iconify collections whose name itself contains a dash — the first-dash split
// would otherwise mangle them (e.g. `simple-icons-github` -> `simple:...`).
const MULTIWORD_COLLECTIONS = [
  "simple-icons",
  "vscode-icons",
  "flat-color-icons",
  "file-icons",
  "line-md",
  "material-symbols",
  "skill-icons",
  "devicon-plain",
];

const props = defineProps<{
  name?: string;
  class?: unknown;
}>();

const normalized = computed<string>(() => {
  let n = props.name;
  if (!n) return "";
  // Strip the UnoCSS-preset `i-` prefix first, so `i-simple-icons:markdown`
  // reduces to a clean `collection:name`.
  if (n.startsWith("i-")) n = n.slice(2);
  if (n.includes(":")) return n; // already `collection:name`
  // Dash form: honor multi-word collection names before the first-dash split.
  for (const c of MULTIWORD_COLLECTIONS) {
    if (n.startsWith(`${c}-`)) return `${c}:${n.slice(c.length + 1)}`;
  }
  const dash = n.indexOf("-");
  if (dash === -1) return n;
  return `${n.slice(0, dash)}:${n.slice(dash + 1)}`;
});

// `@iconify/vue` resolves icon data asynchronously from the Iconify HTTP API, so
// it can't render the real `<svg>` during a single synchronous render unless the
// data is already in Iconify's storage. `entry-server.ts` preloads a page's
// icons and re-renders (see `ssr/icons.ts`), and `main.ts` seeds that data into
// the client before mount — so `ready` is the ONE signal that is guaranteed to
// agree between the server's final render and the client's first render:
//   - server: the icon is in (process-global) Iconify storage after preload;
//   - client: the icon was in the hydration payload (`isIconSeeded`) — we
//     deliberately ignore Iconify's own storage here, so an icon the browser
//     cached in localStorage but the server didn't seed can't render ahead of it.
// When `ready`, render the real icon (matches on both sides). Otherwise emit a
// placeholder and defer the real icon to `onMounted`, so the client's async load
// (or localStorage cache) only takes effect AFTER hydration — never a mismatch.
const ready = computed(() => {
  const n = normalized.value;
  if (!n) return false;
  if (import.meta.server) {
    // Registering here (during render) ties collection to icons actually
    // rendered — an icon in a `v-if`-false branch is never requested.
    registerServerIcon(n);
    return iconLoaded(n);
  }
  return isIconSeeded(n);
});

const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});
</script>

<template>
  <!-- `ssr` makes Iconify emit the icon body synchronously (it otherwise defers
       the body to its own `onMounted`, so the server would render empty even with
       the data loaded). Safe because we only mount this when `ready` guarantees
       the data is in storage on BOTH sides — or post-mount, where it's moot. -->
  <IconifyIcon v-if="ready || mounted" :ssr="true" :icon="normalized" :class="props.class" />
  <!-- Placeholder for SSR + the first client render of a not-yet-loaded icon —
       same box as Iconify's unresolved state, so hydration matches. -->
  <svg
    v-else
    :class="props.class"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    aria-hidden="true"
    role="img"
  />
</template>
