/** `get_current_page` — what the visitor is looking at right now. */
import type { AppRouter } from "@app/router.ts";
import type { ModelContextTool } from "../types.ts";
import { currentPage } from "./content.ts";

export function currentPageTool(router: AppRouter): ModelContextTool {
  return {
    name: "get_current_page",
    title: "Get the current page",
    description:
      `Return the documentation page the user is currently viewing: its route ` +
      `path, URL, title, description and heading outline. Use this to ground ` +
      `answers in what the user is actually looking at.`,
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () => currentPage(router),
  };
}
