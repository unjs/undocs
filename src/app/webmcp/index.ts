/**
 * WebMCP (https://webmachinelearning.github.io/webmcp/) integration.
 *
 * WebMCP lets a page hand its own capabilities to a browser-resident AI agent as
 * MCP tools: `document.modelContext.registerTool(...)`. We register a handful of
 * docs tools (search / list / read / current page / navigate — see `./tools/`)
 * so an agent sitting in the browser can answer questions about the docs and
 * drive the site, using the site's own search index rather than scraping the DOM.
 *
 * The API is a draft and shipping behind flags, so everything here is
 * best-effort: a failed registration warns rather than throws. Registration
 * lives on an `AbortSignal` — the spec's only unregister path — which is what
 * lets a dev HMR reload replace the tools cleanly.
 *
 * This module is the LAZY half of the integration. `main.ts` imports it as its
 * own chunk: straight away when the browser has a native `document.modelContext`,
 * and otherwise only when an agent first asks `./polyfill.ts` for tools.
 */
import { createDocsTools } from "./tools/index.ts";
import type { AppRouter } from "@app/router.ts";

export type { ModelContext, ModelContextTool, RegisteredTool } from "./types.ts";

/** The live registration, so a re-setup (dev HMR) can retire the previous one. */
let controller: AbortController | undefined;

/**
 * Register the docs tools with the browser agent. Returns a teardown function.
 * Safe to call on an unsupported browser (no-op) and safe to call twice (the
 * previous registration is aborted first — re-registering the same tool name
 * would otherwise reject with `InvalidStateError`).
 */
export async function setupWebMCP(router: AppRouter): Promise<() => void> {
  const modelContext = document.modelContext;
  if (!modelContext) return () => {};

  controller?.abort();
  const ac = (controller = new AbortController());

  for (const tool of createDocsTools(router)) {
    // Registration is per-tool: a rejection (duplicate name, invalid schema, or
    // `NotAllowedError` from the `tools` permissions policy) must not take the
    // rest of the set — or the page — down with it.
    try {
      await modelContext.registerTool(tool, { signal: ac.signal });
    } catch (error) {
      console.warn(`[undocs] WebMCP: could not register \`${tool.name}\``, error);
    }
  }

  return () => ac.abort();
}

// Dev only: HMR would otherwise stack a second copy of every tool on the next
// edit. Statically eliminated from the production bundle.
if (import.meta.hot) {
  import.meta.hot.dispose(() => controller?.abort());
}
