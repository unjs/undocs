import { defineEventHandler, getRouterParam, HTTPError, redirect } from "nitro/h3";
import { withLeadingSlash } from "ufo";
import { pageSource } from "../../content/source.ts";
import { getIndex } from "../../content/store.ts";
import { suggestPages, type Suggestions } from "../../content/suggest.ts";

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
    // Markdown is what agents ask for, so a guessed `.md` path gets the same
    // second chance as the HTML 404: the confident match, or a list to pick from.
    const suggestions = suggestPages(index, path);
    if (suggestions.redirect) {
      return redirect(rawPath(suggestions.redirect.split("#")[0]!) + event.url.search, 302);
    }
    return new Response(notFoundMarkdown(path, suggestions), {
      status: 404,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  event.res.headers.set("Content-Type", "text/markdown; charset=utf-8");
  return await pageSource(page);
});

function rawPath(path: string): string {
  return `/raw${path === "/" ? "/index" : path}.md`;
}

function notFoundMarkdown(path: string, { results }: Suggestions): string {
  const lines = [`# Page not found`, "", `\`${path}\` does not exist.`];
  if (results.length) {
    lines.push("", "Closest pages:", "");
    for (const r of results) {
      const about = r.preview ? ` — ${r.preview.replaceAll(/\s+/g, " ").trim()}` : "";
      lines.push(`- [${r.title}](${rawPath(r.path)})${about}`);
    }
  }
  lines.push("", "Every page is listed in [/llms.txt](/llms.txt).", "");
  return lines.join("\n");
}
