import { defineEventHandler, getRouterParam, HTTPError } from "nitro/h3";
import { withLeadingSlash } from "ufo";
import { pageSource } from "../../content/source.ts";
import { getIndex } from "../../content/store.ts";

/** Serve the source markdown for a page at `/raw/<path>.md`. */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug?.endsWith(".md")) {
    throw new HTTPError({ status: 404, statusText: "Page not found" });
  }

  // `/raw/index.md` is the docs root: `toRoutePath` strips `index` from every
  // route, so `/index` is never a page of its own and the alias is unambiguous.
  const path = withLeadingSlash(slug.replace(/\.md$/, "")).replace(/^\/index$/, "/");
  const index = await getIndex();
  const page = index.byPath.get(path) || index.byPath.get(path + "/");
  if (!page) {
    throw new HTTPError({ status: 404, statusText: "Page not found" });
  }

  event.res.headers.set("Content-Type", "text/markdown; charset=utf-8");
  return await pageSource(page);
});
