/** `get_current_page` — what the visitor is looking at right now. */
import type { AppRouter } from "@app/router.ts";
import type { ModelContextTool } from "../types.ts";
import { currentPage } from "./content.ts";

export function currentPageTool(router: AppRouter): ModelContextTool {
  return {
    name: "get_current_page",
    title: "Get the current page",
    description:
      "Get metadata for the page the user is viewing: path, URL, title, description and heading outline.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => currentPage(router),
  };
}
