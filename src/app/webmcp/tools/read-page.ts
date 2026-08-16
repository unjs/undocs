/** `read_page` — the Markdown source of one page, in cursor-paged slices. */
import { $fetch } from "ofetch";
import { joinURL } from "ufo";

import type { ModelContextTool } from "../types.ts";
import { pageLinks, probePage } from "./content.ts";
import { clampOffset, resolveDocsPath, STANDALONE_ROUTES } from "./utils.ts";

/**
 * Cap on the Markdown one `read_page` call returns, so a long page can't fill an
 * agent's whole context in one go. Not a hard limit on what it can read: the
 * result carries a `nextOffset` cursor for the remainder (and `markdownUrl` /
 * `llms-full.txt` for an agent that would rather fetch the text itself).
 */
const MARKDOWN_MAX = 40_000;

/**
 * The "nothing to read here" error. `/` and `/blog` are real routes an agent
 * will have seen in a result, but they're generated — no content-index entry,
 * so no `/raw` source. A bare "not found" would read as a broken link instead
 * of "this page exists, it just isn't written in Markdown".
 */
function noSourceError(path: string, redirectedFrom?: string): Error {
  if (!STANDALONE_ROUTES.has(path)) {
    return new Error(
      redirectedFrom
        ? `\`${redirectedFrom}\` redirects to \`${path}\`, which is not a documentation page.`
        : `No documentation page at \`${path}\`.`,
    );
  }
  return new Error(
    `\`${path}\` is generated, not written in Markdown, so it has no source to read. ` +
      `Use \`list_pages\` for the pages that do` +
      (path === "/" ? ", or `get_project_info` for the project's links." : "."),
  );
}

export function readPageTool(): ModelContextTool {
  return {
    name: "read_page",
    title: "Read a documentation page",
    description:
      `Return the Markdown source of one documentation page, given its route ` +
      `path (e.g. '/guide/getting-started'). Paths come from \`search_docs\`, ` +
      `\`list_pages\` or \`get_current_page\`. A long page comes back ` +
      `truncated with a \`nextOffset\` — call again with that \`offset\` for ` +
      `the rest. Generated routes (the landing page, the blog listing) have no ` +
      `Markdown source.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Route path of the page, e.g. '/guide/getting-started'.",
        },
        offset: {
          type: "integer",
          description:
            "Character offset to read from — pass the `nextOffset` of a truncated result to continue (default 0).",
          minimum: 0,
        },
      },
      required: ["path"],
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    async execute({ path: input, offset } = {}) {
      // Follow a configured redirect first: `/raw/<old>.md` has no entry in the
      // content index, so reading a moved path would 404 on a page the site
      // still serves (the route rule redirects a browser hitting it).
      const { path, redirectedFrom, external } = resolveDocsPath(input);
      if (external) {
        throw new Error(
          `\`${redirectedFrom}\` redirects to ${path}, which is outside this ` +
            `documentation site — there is no Markdown source to read. Open the URL instead.`,
        );
      }

      // `/raw/**` serves the page's source markdown (frontmatter stripped,
      // title/description ensured) — the same text `llms.txt` links to.
      let markdown: string;
      try {
        markdown = await $fetch<string, "text">(joinURL("/raw", `${path}.md`), {
          responseType: "text",
        });
      } catch (error: any) {
        const status = error?.statusCode ?? error?.response?.status;
        if (status === 404) throw noSourceError(path, redirectedFrom);
        throw error;
      }

      // Long pages are handed over in `MARKDOWN_MAX` slices: `nextOffset` is
      // the cursor for the remainder, so truncation is a pause, not a dead end.
      const start = Math.min(clampOffset(offset), markdown.length);
      const slice = markdown.slice(start, start + MARKDOWN_MAX);
      const end = start + slice.length;

      // Metadata under OUR key, never the docs page's. A 200 from `/raw` proves
      // the path is real, but `page()`'s `kebabCase` key is lossy between two
      // paths that are BOTH real: `/guide-deploy` and `/guide/deploy` share one
      // entry, so caching either here hands the visitor's next navigation to
      // the other one the wrong page's title, description and outline.
      const doc = await probePage(path);
      return {
        path,
        redirectedFrom,
        ...pageLinks(path, doc),
        title: doc?.title ?? "",
        description: doc?.description ?? "",
        length: markdown.length,
        offset: start,
        truncated: end < markdown.length,
        nextOffset: end < markdown.length ? end : undefined,
        markdown: slice,
      };
    },
  };
}
