import { defineEventHandler, getRouterParam, HTTPError } from "nitro/h3";
import { withLeadingSlash } from "ufo";
import { pageSource } from "../../content/source.ts";
import { getIndex } from "../../content/store.ts";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug?.endsWith(".md")) {
    throw new HTTPError({ status: 404, statusText: "Page not found" });
  }

  // `/index` cannot be a page route, so it unambiguously aliases the docs root.
  const path = withLeadingSlash(slug.replace(/\.md$/, "")).replace(/^\/index$/, "/");
  const index = await getIndex();
  const page = index.byPath.get(path) || index.byPath.get(path + "/");
  if (!page) {
    throw new HTTPError({ status: 404, statusText: "Page not found" });
  }

  event.res.headers.set("Content-Type", "text/markdown; charset=utf-8");
  return await pageSource(page);
});
