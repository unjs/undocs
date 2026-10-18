import { defineEventHandler, getRouterParam, HTTPError } from "nitro/h3";
import { withLeadingSlash } from "ufo";
import { pageSource } from "../../content/source.ts";
import { getIndex } from "../../content/store.ts";
import { notFoundMarkdown, rawPath, suggestPages } from "../../content/suggest.ts";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug", { decode: true });
  if (!slug?.endsWith(".md")) {
    throw new HTTPError({ status: 404, statusText: "Page not found" });
  }

  // `/index` cannot be a page route, so it unambiguously aliases the docs root.
  const path = withLeadingSlash(slug.replace(/\.md$/, "")).replace(/^\/index$/, "/");
  const index = await getIndex();
  const page = index.byPath.get(path) || index.byPath.get(path + "/");
  if (!page) {
    // Markdown is what agents ask for, so a guessed `.md` path gets the same
    // second chance as the HTML 404: the confident match, or a list to pick from.
    const suggestions = suggestPages(index, path);
    // No body: h3's `redirect()` answers with an HTML meta-refresh page, which
    // is the wrong thing to hand a client that asked for markdown.
    if (suggestions.redirect) {
      const location = rawPath(suggestions.redirect.split("#")[0]!) + event.url.search;
      return new Response(null, { status: 302, headers: { location } });
    }
    return new Response(notFoundMarkdown(path, suggestions), {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  event.res.headers.set("Content-Type", "text/markdown; charset=utf-8");
  return await pageSource(page);
});
