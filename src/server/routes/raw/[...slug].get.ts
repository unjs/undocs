import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { defineEventHandler, getRouterParam, HTTPError } from "nitro/h3";
import { withLeadingSlash } from "ufo";
import { getIndex, getDocsDir } from "../../content/store";

/** Serve the source markdown for a page at `/raw/<path>.md`. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug?.endsWith(".md")) {
    throw new HTTPError({ status: 404, statusText: "Page not found" });
  }

  const path = withLeadingSlash(slug.replace(/\.md$/, ""));
  const index = await getIndex();
  const page = index.byPath.get(path) || index.byPath.get(path + "/");
  if (!page) {
    throw new HTTPError({ status: 404, statusText: "Page not found" });
  }

  let source = await readFile(join(getDocsDir(), page.rel), "utf-8");

  // Strip frontmatter for the raw view
  source = source.replace(/^---\n[\s\S]*?\n---\n/, "");

  // Ensure a leading title/description
  if (!/^\s*#\s/.test(source)) {
    const intro = `# ${page.title}\n\n${page.description ? `> ${page.description}\n\n` : ""}`;
    source = intro + source;
  }

  event.res.headers.set("Content-Type", "text/markdown; charset=utf-8");
  return source;
});
