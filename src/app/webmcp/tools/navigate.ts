/** `navigate` — the one tool that moves the visitor. */
import type { AppRouter } from "@app/router.ts";
import type { ModelContextTool } from "../types.ts";
import { currentPage, routeExists } from "./content.ts";
import { normalizePath } from "./utils.ts";

export function navigateTool(router: AppRouter): ModelContextTool {
  return {
    name: "navigate",
    title: "Open a documentation page",
    description:
      `Navigate the browser tab to a documentation page, optionally scrolling ` +
      `to a heading anchor. This changes what the user sees — only use it when ` +
      `the user asked to be taken somewhere. To READ a page without moving ` +
      `them, use \`read_page\`.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Route path to open, e.g. '/guide/getting-started'.",
        },
        hash: {
          type: "string",
          description: "Optional heading anchor to scroll to, e.g. '#installation'.",
        },
      },
      required: ["path"],
    },
    // The result embeds the landed page's title/description/outline — the same
    // docs prose every other tool flags.
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    async execute({ path: input, hash } = {}) {
      const path = normalizePath(input);
      // Refuse dead links rather than dumping the visitor on a 404 page.
      if (!(await routeExists(path))) {
        throw new Error(`No documentation page at \`${path}\`.`);
      }

      const anchor = hash ? `#${String(hash).replace(/^#/, "")}` : "";
      await router.push({ path, hash: anchor || undefined });
      return { navigated: true, ...(await currentPage(router)) };
    },
  };
}
