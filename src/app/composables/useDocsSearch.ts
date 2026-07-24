import { ref } from "vue";

// Module-level singleton state so any sibling (e.g. DocsSearchButton) can
// drive the DocsSearch command palette without prop-drilling or injection.
const open = ref(false);

export function useDocsSearch() {
  function toggle() {
    open.value = !open.value;
  }
  function close() {
    open.value = false;
  }
  return { open, toggle, close };
}
