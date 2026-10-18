import { defineEventHandler, getRouterParam, HTTPError } from "nitro/h3";
import { withLeadingSlash } from "ufo";
import { pageSource } from "../../content/source.ts";
import { getIndex } from "../../content/store.ts";
import { suggestPages, type Suggestions } from "../../content/suggest.ts";

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

/** `path` as its raw URL; pass it encoded (`redirect` is) or it is encoded here. */
function rawPath(path: string, encode = false): string {
  const raw = `/raw${path === "/" ? "/index" : path}.md`;
  return encode ? encodeURI(raw) : raw;
}

function notFoundMarkdown(path: string, { results }: Suggestions): string {
  const lines = [`# Page not found`, "", `\`${path}\` does not exist.`];
  if (results.length) {
    lines.push("", "Closest pages:", "");
    for (const r of results) {
      const about = r.preview ? ` — ${r.preview.replaceAll(/\s+/g, " ").trim()}` : "";
      const title = r.title.replaceAll(/[\\[\]]/g, "\\$&");
      lines.push(`- [${title}](<${rawPath(r.path, true)}>)${about}`);
    }
  }
  lines.push("", "Every page is listed in [/llms.txt](/llms.txt).", "");
  return lines.join("\n");
}
