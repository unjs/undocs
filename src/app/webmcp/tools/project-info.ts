/** `get_project_info` — the project's metadata and canonical links. */
import { withLeadingSlash } from "ufo";

import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { repoLinks, socialLinks } from "../links.ts";
import type { ModelContextTool } from "../types.ts";
import { arraySchema, objectSchema, SITE_PROPERTIES } from "./schemas.ts";
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
    outputSchema: objectSchema(
      {
        site: objectSchema(
          {
            ...SITE_PROPERTIES,
            url: { type: "string", description: "Absolute URL of the documentation site." },
          },
          ["url"],
        ),
        // Absent when the docs config names no repository; `issues`/`releases`
        // only when that repository is really on GitHub (see `../links.ts`).
        repository: objectSchema(
          {
            url: { type: "string", description: "Repository URL." },
            issues: { type: "string", description: "Issue tracker URL, for a GitHub repository." },
            releases: { type: "string", description: "Releases URL, for a GitHub repository." },
            branch: { type: "string", description: "Branch the documentation is edited on." },
          },
          ["url", "branch"],
        ),
        links: arraySchema(
          objectSchema(
            {
              label: { type: "string", description: "Human-readable name of the destination." },
              url: { type: "string", description: "Absolute URL." },
            },
            ["label", "url"],
          ),
          "Community and social links from the docs config; empty when none are configured.",
        ),
        llms: objectSchema(
          {
            index: {
              type: "string",
              description: "URL of `llms.txt`: the page index as plain text.",
            },
            full: {
              type: "string",
              description: "URL of `llms-full.txt`: every page's Markdown in one file.",
            },
          },
          ["index", "full"],
        ),
        versions: arraySchema(
          objectSchema(
            {
              label: { type: "string", description: "Version label, e.g. `v3`." },
              url: { type: "string", description: "Absolute URL of that version's docs." },
              active: {
                type: "boolean",
                description: "Present and true for the version served here.",
              },
            },
            ["url"],
          ),
          "Other documented versions of this project; absent when none are configured.",
        ),
      },
      ["site", "links", "llms"],
    ),
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
