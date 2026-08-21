/**
 * The docs tools we hand to a WebMCP agent — one module per tool.
 *
 * Every tool is a thin wrapper over machinery the page already owns — the
 * MiniSearch index the command palette loads, the `/api/docs/*` data cached in
 * `useAsyncData`, the router — so an agent driving the page sees exactly what a
 * visitor sees, and warm caches are reused rather than refetched. The shared
 * parts live in `./content.ts` (cached data access) and `./utils.ts` (agent
 * input coercion + URL shaping).
 *
 * CLIENT-ONLY: this module is dynamically imported from `main.ts` after mount
 * and never evaluated during SSR.
 */
import type { AppRouter } from "@app/router.ts";
import type { ModelContextTool } from "../types.ts";
import { currentPageTool } from "./current-page.ts";
import { listPagesTool } from "./list-pages.ts";
import { navigateTool } from "./navigate.ts";
import { projectInfoTool } from "./project-info.ts";
import { readPageTool } from "./read-page.ts";
import { searchDocsTool } from "./search-docs.ts";

/**
 * Order is the order the agent sees them in, so it reads as a workflow:
 * find a page (search / list / project info) → read it → act on the visitor.
 */
export function createDocsTools(router: AppRouter): ModelContextTool[] {
  return [
    searchDocsTool(router),
    listPagesTool(),
    projectInfoTool(),
    readPageTool(),
    currentPageTool(router),
    navigateTool(router),
  ];
}
