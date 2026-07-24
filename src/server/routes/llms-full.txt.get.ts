import { defineEventHandler } from "nitro/h3";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { useRuntimeConfig } from "nitro/runtime-config";
import { getIndex } from "../content/store";

/** Generate `/llms-full.txt`: the full markdown of every page concatenated. */
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig().undocs as {
    dir: string;
    llmsFull: { title: string; description: string };
  };
  const index = await getIndex();

  const parts: string[] = [];
  parts.push(`# ${cfg.llmsFull.title}`, "");
  if (cfg.llmsFull.description) parts.push(`> ${cfg.llmsFull.description}`, "");

  for (const page of index.pages) {
    let source = await readFile(join(cfg.dir, page.rel), "utf-8");
    source = source.replace(/^---\n[\s\S]*?\n---\n/, ""); // strip frontmatter
    if (!/^\s*#\s/.test(source)) {
      source = `# ${page.title}\n\n${page.description ? `> ${page.description}\n\n` : ""}${source}`;
    }
    parts.push("", "---", "", source.trim(), "");
  }

  event.res.headers.set("Content-Type", "text/plain; charset=utf-8");
  return parts.join("\n");
});
