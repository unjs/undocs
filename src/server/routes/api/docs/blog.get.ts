import { defineEventHandler } from "nitro/h3";
import { getIndex } from "../../../content/store";

/**
 * The `/blog/` listing, newest-first. A fixed, query-less path so it prerenders
 * to disk like `navigation`/`search`.
 */
export default defineEventHandler(async () => {
  const prefix = "/blog/";
  const index = await getIndex();
  const items = index.pages
    .filter((p) => p.path.startsWith(prefix) && p.path !== prefix.replace(/\/$/, ""))
    .sort((a, b) => a.order.localeCompare(b.order) * -1);

  return items.map((p) => ({
    path: p.path,
    title: p.title,
    description: p.description,
    meta: p.meta,
  }));
});
