import { defineEventHandler, getRouterParam, HTTPError } from "nitro/h3";
import { withLeadingSlash } from "ufo";
import { getIndex, getDocsDir } from "../../../../content/store.ts";
import { loadDocsConfig } from "../../../../docs-config.ts";
import { getPluginRuntime } from "../../../../plugins/runtime.ts";
import { acceptSurroundNeighbor } from "../../../../plugins/apply.ts";
import type { SurroundItem } from "../../../../content/types.ts";

function surroundAt(
  order: string[],
  pagePath: string,
  index: number,
  direction: -1 | 1,
  plugins: Awaited<ReturnType<typeof getPluginRuntime>>["plugins"],
  ctx: Awaited<ReturnType<typeof getPluginRuntime>>["ctx"],
  byPath: Map<string, { title: string; description?: string; path: string }>,
): SurroundItem | null {
  for (let j = index + direction; j >= 0 && j < order.length; j += direction) {
    const neighborPath = order[j]!;
    if (!acceptSurroundNeighbor(pagePath, neighborPath, plugins, ctx)) continue;
    const neighbor = byPath.get(neighborPath);
    return neighbor
      ? {
          title: neighbor.title,
          description: neighbor.description ?? "",
          path: neighbor.path,
        }
      : null;
  }
  return null;
}

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

  const docsDir = getDocsDir();
  const docs = await loadDocsConfig(docsDir);
  const { plugins, ctx } = await getPluginRuntime(docsDir, docs);

  const i = index.order.indexOf(page.path);
  const surround: [SurroundItem | null, SurroundItem | null] =
    i === -1
      ? [null, null]
      : [
          surroundAt(index.order, page.path, i, -1, plugins, ctx, index.byPath),
          surroundAt(index.order, page.path, i, 1, plugins, ctx, index.byPath),
        ];

  return { ...page, surround };
});
