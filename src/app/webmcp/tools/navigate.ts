/** `navigate` — the one tool that moves the visitor. */
import type { AppRouter } from "@app/router.ts";
import type { ModelContextTool } from "../types.ts";
import { currentPage, routeExists } from "./content.ts";
import { resolveDocsPath } from "./utils.ts";

export function navigateTool(router: AppRouter): ModelContextTool {
  return {
    name: "navigate",
    title: "Open a documentation page",
    description:
      `Open a documentation page in the user's browser, optionally at a heading. ` +
      `Use only when the user asks to navigate; use \`read_page\` to inspect content without moving them.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Route path to open, e.g. '/guide/getting-started'.",
        },
        hash: {
          type: "string",
          description: "Heading anchor to scroll to, e.g. '#installation'.",
        },
      },
      required: ["path"],
    },
    annotations: { readOnlyHint: false },
    async execute({ path: input, hash } = {}) {
      // A moved path is a real destination: resolve the docs config's redirects
      // the way the router will, so validation judges where the agent is
      // actually going rather than the URL it happened to be holding.
      const { path, redirectedFrom, external } = resolveDocsPath(input);
      const anchor = hash ? `#${String(hash).replace(/^#/, "")}` : "";
      // Either way we push what the AGENT asked for — a redirect is the
      // router's to execute (it swaps the target into history in place, and
      // sends an absolute one to `window.location`), exactly as it would for a
      // visitor clicking a link to the same moved path.
      const asked = redirectedFrom ?? path;

      // A redirect out of the docs site is a full page load: this document is
      // on its way out, so there is no landed page to describe — report the
      // destination instead of a snapshot of the page being left.
      if (external) {
        await router.push({ path: asked, hash: anchor || undefined });
        return { navigated: true, external: true, redirectedFrom, url: path };
      }

      // Refuse dead links rather than dumping the visitor on a 404 page.
      if (!(await routeExists(path))) {
        throw new Error(
          redirectedFrom
            ? `\`${redirectedFrom}\` redirects to \`${path}\`, which is not a documentation page.`
            : `No documentation page at \`${path}\`.`,
        );
      }

      await router.push({ path: asked, hash: anchor || undefined });
      return { navigated: true, redirectedFrom, ...(await currentPage(router)) };
    },
  };
}
