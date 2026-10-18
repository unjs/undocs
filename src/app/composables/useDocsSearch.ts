import { ref } from "vue";

// Module-level singleton state so any sibling (e.g. DocsSearchButton) can
// drive the DocsSearch command palette without prop-drilling or injection.
// Both refs are only ever WRITTEN from client event handlers, never during a
// render, so the server's concurrent renders cannot see one another's value.
const open = ref(false);

/**
 * Text the palette opens with — consumed and cleared by `DocsSearch` as it
 * opens. Set before `open`, so the input mounts holding it, and the focus
 * scope's autofocus selects it: typing replaces the guess, arrows refine it.
 */
const initialQuery = ref("");

export function useDocsSearch() {
  function toggle() {
    open.value = !open.value;
  }
  function close() {
    open.value = false;
  }
  /** Open the palette with `query` already typed in (the 404 page's guess). */
  function openWith(query: string) {
    initialQuery.value = query;
    open.value = true;
  }
  return { open, initialQuery, toggle, close, openWith };
}
