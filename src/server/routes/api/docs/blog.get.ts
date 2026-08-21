import { defineEventHandler } from "nitro/h3";
import { getIndex } from "../../../content/store.ts";

export default defineEventHandler(async () => {
  const index = await getIndex();
  const items = index.pages
    .filter((p) => {
      if (p.path.startsWith("/blog/")) return true;
      // Locale-prefixed posts: `/ru/blog/hello`
      const parts = p.path.replace(/^\//, "").split("/");
      return parts.length >= 3 && parts[1] === "blog";
    })
    .sort((a, b) => a.order.localeCompare(b.order) * -1);

  return items.map((p) => ({
    path: p.path,
    title: p.title,
    description: p.description,
    meta: p.meta,
  }));
});
