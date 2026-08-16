/** `get_project_info` — the project's metadata and canonical links. */
import { withLeadingSlash } from "ufo";

import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { repoLinks, socialLinks } from "../links.ts";
import type { ModelContextTool } from "../types.ts";
import { pageUrl } from "./utils.ts";

/**
 * The `versions` config as linkable entries. Its `to` is whatever the docs
 * author wrote — usually another site, but it may be a relative path, and every
 * other tool hands back absolute URLs.
 */
function docsVersions(versions: unknown) {
  if (!Array.isArray(versions) || versions.length === 0) return undefined;
  return versions
    .filter((v) => v && typeof v === "object")
    .map((v: { label?: string; to?: string; active?: boolean }) => ({
      label: v.label,
      url:
        typeof v.to === "string" && /^https?:\/\//i.test(v.to)
          ? v.to
          : pageUrl(withLeadingSlash(String(v.to ?? "/"))),
      active: v.active || undefined,
    }));
}

export function projectInfoTool(): ModelContextTool {
  const appConfig = useAppConfig();
  return {
    name: "get_project_info",
    title: "Get project info and links",
    description:
      "Get project metadata and links: website, source repository, issues, releases, community, `llms.txt` bundles and versions.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute() {
      const docs = appConfig.docs || {};
      return {
        site: {
          name: appConfig.site?.name,
          description: appConfig.site?.description,
          url: appConfig.site?.url || pageUrl("/"),
        },
        repository: repoLinks(docs.github, docs.branch),
        links: socialLinks(docs.socials),
        // The plain-text bundles of this same content, for an agent that would
        // rather ingest the whole corpus than call `read_page` per page.
        llms: {
          index: pageUrl("/llms.txt"),
          full: pageUrl("/llms-full.txt"),
        },
        versions: docsVersions(docs.versions),
      };
    },
  };
}
