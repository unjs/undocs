import { defineEventHandler, getRouterParam, HTTPError } from "nitro/h3";
import { withLeadingSlash } from "ufo";
import { getIndex } from "../../../../content/store";
import type { SurroundItem } from "../../../../content/types";

export default defineEventHandler(async (event) => {
  // Path-addressed so the prerenderer can write each page's JSON to disk;
  // `.json` disambiguates `guide.json` from the `guide/` dir a nested page
  // needs. Falls back to pathname parsing without a matched router param
  // (e.g. tests calling `.fetch(Request)` directly).
  const slug = (
    getRouterParam(event, "path") ||
    decodeURIComponent(event.url.pathname).replace(/^\/api\/docs\/page\//, "")
  ).replace(/\.json$/, "");

  // `_index` (and the empty slug) is the root page; every other slug maps back to
  // a leading-slash doc path. Tolerate a trailing slash to match the old handler.
  const path = !slug || slug === "_index" ? "/" : withLeadingSlash(slug).replace(/\/$/, "") || "/";

  const index = await getIndex();
  const page = index.byPath.get(path) || index.byPath.get(path + "/");
  if (!page) {
    throw new HTTPError({ status: 404, statusText: "Page not found", message: path });
  }

  // Embed the `[prev, next]` surround (derived from the global content order) so
  // a page render is one request, not two. The neighbors come from `index.order`
  // (which excludes blog); a lookup miss yields `null`.
  const at = (p: string | undefined): SurroundItem | null => {
    const neighbor = p ? index.byPath.get(p) : undefined;
    return neighbor
      ? { title: neighbor.title, description: neighbor.description, path: neighbor.path }
      : null;
  };
  const i = index.order.indexOf(page.path);
  const surround: [SurroundItem | null, SurroundItem | null] =
    i === -1 ? [null, null] : [at(index.order[i - 1]), at(index.order[i + 1])];

  return { ...page, surround };
});
