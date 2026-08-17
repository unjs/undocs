import { defineEventHandler } from "nitro/h3";
import { getIndex } from "../../../content/store.ts";

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
