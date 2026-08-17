/** `read_page` — the Markdown source of one page, in cursor-paged slices. */
import { $fetch } from "ofetch";
import { joinURL } from "ufo";

import type { ModelContextTool } from "../types.ts";
import { pageLinks, probePage } from "./content.ts";
import {
  objectSchema,
  PAGE_LINK_PROPERTIES,
  PAGE_TEXT_PROPERTIES,
  PATH_PROPERTY,
  REDIRECTED_FROM_PROPERTY,
} from "./schemas.ts";
import {
  clampLimit,
  clampOffset,
  resolveDocsPath,
  STANDALONE_ROUTES,
  textResult,
} from "./utils.ts";

/**
 * Cap on the Markdown one `read_page` call returns, so a long page can't fill an
 * agent's whole context in one go. Not a hard limit on what it can read: the
 * result carries a `nextOffset` cursor for the remainder (and `markdownUrl` /
 * `llms-full.txt` for an agent that would rather fetch the text itself).
 *
 * It is also the CEILING rather than the whole story — a caller with a smaller
 * context window passes `maxLength` to take the page in finer slices, walking
 * the same `nextOffset` cursor. Without that, a model too small for 40k chars
 * could only take the default or nothing at all.
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
      `Read a documentation page as Markdown by route path. Links in it are route ` +
      `paths for this tool. If \`truncated\`, continue with \`nextOffset\` as \`offset\`. ` +
      `Generated pages have no Markdown source.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Route path of the page, e.g. '/guide/getting-started'.",
        },
        offset: {
          type: "integer",
          description: "Character offset; use `nextOffset` to continue (default 0).",
          minimum: 0,
        },
        maxLength: {
          type: "integer",
          description: `Maximum Markdown characters to return (1-${MARKDOWN_MAX}, default ${MARKDOWN_MAX}).`,
          minimum: 1,
          maximum: MARKDOWN_MAX,
        },
      },
      required: ["path"],
    },
    // Describes `structuredContent`. The Markdown itself is NOT here: it rides
    // in the result's text block, which is why this tool has an envelope at all.
    outputSchema: objectSchema(
      {
        path: PATH_PROPERTY,
        redirectedFrom: REDIRECTED_FROM_PROPERTY,
        ...PAGE_LINK_PROPERTIES,
        ...PAGE_TEXT_PROPERTIES,
        length: {
          type: "integer",
          description: "Length of the page's whole Markdown source, in characters.",
        },
        offset: { type: "integer", description: "Character offset this slice starts at." },
        truncated: {
          type: "boolean",
          description: "Whether Markdown remains after this slice.",
        },
        nextOffset: {
          type: "integer",
          description: "Pass as `offset` to read the next slice; absent when `truncated` is false.",
        },
      },
      ["path", "url", "title", "description", "length", "offset", "truncated"],
    ),
    annotations: { readOnlyHint: true },
    async execute({ path: input, offset, maxLength } = {}) {
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
      // title/description ensured, file-relative links resolved to route paths
      // — see `server/content/source.ts`) — the same text `llms.txt` links to.
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

      // Long pages are handed over in slices: `nextOffset` is the cursor for
      // the remainder, so truncation is a pause, not a dead end. The slice is
      // `maxLength` when the caller asked for a smaller one, `MARKDOWN_MAX`
      // otherwise — an over-large or nonsense `maxLength` clamps to the cap
      // rather than rejecting the call.
      const start = Math.min(clampOffset(offset), markdown.length);
      const slice = markdown.slice(
        start,
        start + clampLimit(maxLength, MARKDOWN_MAX, MARKDOWN_MAX),
      );
      const end = start + slice.length;

      // Metadata under OUR key, never the docs page's. A 200 from `/raw` proves
      // the path is real, but `page()`'s `kebabCase` key is lossy between two
      // paths that are BOTH real: `/guide-deploy` and `/guide/deploy` share one
      // entry, so caching either here hands the visitor's next navigation to
      // the other one the wrong page's title, description and outline.
      const doc = await probePage(path);
      // The Markdown rides in the result's TEXT block, not in a JSON field —
      // this is the tool whose answer is prose, and a whole page of it escaped
      // into a JSON string is what `textResult` exists to avoid.
      return textResult(slice, {
        path,
        redirectedFrom,
        ...pageLinks(path, doc),
        title: doc?.title ?? "",
        description: doc?.description ?? "",
        length: markdown.length,
        offset: start,
        truncated: end < markdown.length,
        nextOffset: end < markdown.length ? end : undefined,
      });
    },
  };
}
