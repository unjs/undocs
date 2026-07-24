import { defineEventHandler } from "nitro/h3";
import { joinURL } from "ufo";
import { useRuntimeConfig } from "nitro/runtime-config";
import { getIndex } from "../content/store";

/** Generate the `/llms.txt` index (links to every page). */
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig().undocs as {
    url: string;
    title: string;
    description: string;
  };
  const index = await getIndex();

  const lines: string[] = [];
  lines.push(`# ${cfg.title}`, "");
  if (cfg.description) lines.push(`> ${cfg.description}`, "");

  lines.push("## Docs", "");
  for (const page of index.pages) {
    const url = joinURL(cfg.url || "", "raw", `${page.path}.md`);
    const desc = page.description ? `: ${page.description}` : "";
    lines.push(`- [${page.title}](${url})${desc}`);
  }
  lines.push("");

  event.res.headers.set("Content-Type", "text/plain; charset=utf-8");
  return lines.join("\n");
});
