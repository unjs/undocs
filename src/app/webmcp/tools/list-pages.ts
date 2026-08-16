/** `list_pages` — every page in the nav tree, in navigation order. */
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import type { ModelContextTool } from "../types.ts";
import { flattenNav, navigation } from "./content.ts";
import { pageUrl, siteName } from "./utils.ts";

export function listPagesTool(): ModelContextTool {
  const appConfig = useAppConfig();
  return {
    name: "list_pages",
    title: "List documentation pages",
    description:
      `List every page of ${siteName()} in navigation order, with its route ` +
      `path and description. Use this to get an overview of what the docs ` +
      `cover; use \`search_docs\` when you have a specific question.`,
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    async execute() {
      const pages = flattenNav(await navigation());
      return {
        site: { name: appConfig.site?.name, description: appConfig.site?.description },
        count: pages.length,
        pages: pages.map((p) => ({ ...p, url: pageUrl(p.path) })),
      };
    },
  };
}
