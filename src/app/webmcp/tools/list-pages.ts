/** `list_pages` — every page in the nav tree, in navigation order. */
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import type { ModelContextTool } from "../types.ts";
import { flattenNav, navigation } from "./content.ts";
import { arraySchema, objectSchema, PATH_PROPERTY, SITE_PROPERTIES } from "./schemas.ts";
import { pageUrl } from "./utils.ts";

export function listPagesTool(): ModelContextTool {
  const appConfig = useAppConfig();
  return {
    name: "list_pages",
    title: "List documentation pages",
    description:
      `List pages in the documentation navigation with titles, paths, URLs and available ` +
      `descriptions. Use for browsing; use \`search_docs\` for a specific topic.`,
    inputSchema: { type: "object", properties: {} },
    outputSchema: objectSchema(
      {
        site: objectSchema(SITE_PROPERTIES),
        count: { type: "integer", description: "Number of pages listed." },
        pages: arraySchema(
          objectSchema(
            {
              title: { type: "string", description: "Page title." },
              path: PATH_PROPERTY,
              description: {
                type: "string",
                description: "Page description, when the navigation entry carries one.",
              },
              url: { type: "string", description: "Absolute URL of the page." },
            },
            ["title", "path", "url"],
          ),
          "Every page in the navigation, in navigation order.",
        ),
      },
      ["site", "count", "pages"],
    ),
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
