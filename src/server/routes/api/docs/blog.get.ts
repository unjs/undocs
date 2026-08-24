import { defineEventHandler } from "nitro/h3";
import { getIndex, getDocsDir } from "../../../content/store.ts";
import { loadDocsConfig } from "../../../docs-config.ts";
import { getPluginRuntime } from "../../../plugins/runtime.ts";
import { isBlogPostPath } from "../../../plugins/apply.ts";

export default defineEventHandler(async () => {
  const index = await getIndex();
  const docsDir = getDocsDir();
  const docs = await loadDocsConfig(docsDir);
  const { plugins, ctx } = await getPluginRuntime(docsDir, docs);

  const items = index.pages
    .filter((p) => isBlogPostPath(p.path, plugins, ctx))
    .sort((a, b) => a.order.localeCompare(b.order) * -1);

  return items.map((p) => ({
    path: p.path,
    title: p.title,
    description: p.description,
    meta: p.meta,
  }));
});
