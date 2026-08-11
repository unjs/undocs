/**
 * WebMCP (https://webmachinelearning.github.io/webmcp/) integration.
 *
 * WebMCP lets a page hand its own capabilities to a browser-resident AI agent as
 * MCP tools: `document.modelContext.registerTool(...)`. We register a handful of
 * docs tools (search / list / read / current page / navigate — see `./tools.ts`)
 * so an agent sitting in the browser can answer questions about the docs and
 * drive the site, using the site's own search index rather than scraping the DOM.
 *
 * The API is a draft and shipping behind flags, so everything here is
 * feature-detected and best-effort: `main.ts` only imports this module when
 * `document.modelContext` exists, and a failed registration warns rather than
 * throws. Registration lives on an `AbortSignal` — the spec's only unregister
 * path — which is what lets a dev HMR reload replace the tools cleanly.
 */
import { createDocsTools } from "./tools";
import type { AppRouter } from "@app/router";

export type { ModelContext, ModelContextTool, RegisteredTool } from "./types";

/** True when this browser exposes WebMCP (implies a secure context). */
export function isWebMCPSupported(): boolean {
  return (
    typeof document !== "undefined" && typeof document.modelContext?.registerTool === "function"
  );
}

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
