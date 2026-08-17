import { defineEventHandler, getRouterParam, HTTPError } from "nitro/h3";
import { withLeadingSlash } from "ufo";
import { getIndex } from "../../../../content/store.ts";
import type { SurroundItem } from "../../../../content/types.ts";

export default defineEventHandler(async (event) => {
  // `.json` disambiguates a page artifact from the directory needed by nested pages.
  const slug = (
    getRouterParam(event, "path") ||
    decodeURIComponent(event.url.pathname).replace(/^\/api\/docs\/page\//, "")
  ).replace(/\.json$/, "");

  // Preserve root and legacy trailing-slash aliases.
  const path = !slug || slug === "_index" ? "/" : withLeadingSlash(slug).replace(/\/$/, "") || "/";

  const index = await getIndex();
  const page = index.byPath.get(path) || index.byPath.get(path + "/");
  if (!page) {
    throw new HTTPError({ status: 404, statusText: "Page not found", message: path });
  }

  // Embed prev/next so page rendering remains one request.
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
