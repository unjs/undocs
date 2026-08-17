/**
 * JSON Schema pieces shared by the docs tools' `outputSchema` declarations.
 *
 * Every tool declares what it ANSWERS with, not just what it takes: which field
 * carries the route path to hand `read_page`, that `nextOffset` continues a
 * truncated page, that `markdownUrl` can be absent. Without it those shapes are
 * discoverable only by calling a tool and reading whatever came back.
 *
 * Two things about the field itself:
 *
 *   - It is MCP's, not WebMCP's. The WebMCP descriptor dictionary declares no
 *     `outputSchema` member and WebIDL discards what it does not declare, so a
 *     NATIVE `registerTool` drops it. It reaches the clients that read
 *     `../polyfill.ts`'s registry — which is every agent that can use these
 *     tools today — and the MCP bridges that map a registered tool onto
 *     `Tool.outputSchema`. Costless where it is dropped, and already right on
 *     the day the spec adopts the member. That is also why each tool's
 *     DESCRIPTION still names the fields an agent has to act on: the description
 *     is the half that survives both paths.
 *   - It describes the STRUCTURED half of a result. For the two prose tools
 *     (`search_docs`, `read_page`) that is `structuredContent`; the text block
 *     beside it is prose for the model rather than data with a shape. For the
 *     rest it is the returned object itself. Same split MCP makes.
 *
 * Objects here are CLOSED (`additionalProperties: false`), so a field added to a
 * result without being described is a test failure rather than something an
 * agent meets first in production — `test/app/webmcp.test.ts` validates each
 * tool's real results against its own schema.
 */

/** A closed object schema; `required` is omitted when empty (a draft-4 client rejects `[]`). */
export function objectSchema(
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> {
  return {
    type: "object",
    properties,
    ...(required.length > 0 && { required }),
    additionalProperties: false,
  };
}

/** An array of one shape. */
export function arraySchema(items: unknown, description: string): Record<string, unknown> {
  return { type: "array", description, items };
}

/**
 * The route path — the field an agent copies into the next call, so it says so
 * here rather than leaving the agent to infer it from an example.
 */
export const PATH_PROPERTY = {
  type: "string",
  description:
    "Route path of the page, e.g. `/guide/deploy` — `read_page`'s and `navigate`'s `path`.",
};

/** The path an agent asked for, kept whenever a configured redirect moved it. */
export const REDIRECTED_FROM_PROPERTY = {
  type: "string",
  description: "The path that was asked for; present only when a configured redirect moved it.",
};

/** `content.ts`'s `pageLinks()`, verbatim: where to read a page and where to edit it. */
export const PAGE_LINK_PROPERTIES = {
  url: { type: "string", description: "Absolute URL of the page." },
  markdownUrl: {
    type: "string",
    description:
      "Absolute URL of the page's Markdown source. Absent for a generated page (`/`, `/blog`), which has none.",
  },
  editUrl: {
    type: "string",
    description:
      "Repository URL for editing the page. Absent when the docs config names no repository, or for a generated page.",
  },
};

/** Title and description, as every page-shaped result carries them. */
export const PAGE_TEXT_PROPERTIES = {
  title: { type: "string", description: "Page title." },
  description: {
    type: "string",
    description: "Page description; an empty string when the page has none.",
  },
};

/** One flattened TOC entry — a heading an agent can link to or navigate into. */
export const HEADING_SCHEMA = objectSchema(
  {
    text: { type: "string", description: "Heading text." },
    hash: {
      type: "string",
      description: "Anchor of the heading, e.g. `#install` — `navigate`'s `hash`.",
    },
    depth: { type: "integer", description: "Heading level: 2 for `##`, 3 for `###`." },
  },
  ["text", "hash", "depth"],
);

/**
 * The page snapshot `content.ts`'s `currentPage()` returns. Shared, because
 * `navigate` answers with the page it landed on — the same object, so the two
 * tools cannot describe it differently.
 */
export const CURRENT_PAGE_PROPERTIES = {
  path: PATH_PROPERTY,
  ...PAGE_LINK_PROPERTIES,
  ...PAGE_TEXT_PROPERTIES,
  headings: arraySchema(HEADING_SCHEMA, "The page's heading outline, in document order."),
};

/** What a page snapshot always carries; the links are the conditional part. */
export const CURRENT_PAGE_REQUIRED = ["path", "url", "title", "description", "headings"];

/** How the site names itself, as `list_pages` and `get_project_info` report it. */
export const SITE_PROPERTIES = {
  name: { type: "string", description: "Site name." },
  description: { type: "string", description: "Site description." },
};
