import { defineEventHandler } from "nitro/h3";
import { useRuntimeConfig } from "nitro/runtime-config";
import { pageSource } from "../content/source.ts";
import { getIndex } from "../content/store.ts";

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig().undocs as {
    llmsFull: { title: string; description: string };
  };
  const index = await getIndex();

  const parts: string[] = [];
  parts.push(`# ${cfg.llmsFull.title}`, "");
  if (cfg.llmsFull.description) parts.push(`> ${cfg.llmsFull.description}`, "");

  for (const page of index.pages) {
    parts.push("", "---", "", (await pageSource(page)).trim(), "");
  }

  event.res.headers.set("Content-Type", "text/plain; charset=utf-8");
  return parts.join("\n");
});
