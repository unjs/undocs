import type { NitroModule } from "nitropack";
import { resolve } from "node:path";
import { readFile, writeFile, glob, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { htmlToMarkdown } from "mdream";

import { defineNuxtModule } from "nuxt/kit";

export default defineNuxtModule((_options, nuxt) => {
  nuxt.options.nitro!.modules ??= [];
  nuxt.options.nitro!.modules.push(mdRewrite());
});

function mdRewrite(): NitroModule {
  return {
    name: "markdown-rewrite",
    setup(nitro) {
      if (nitro.options.dev) {
        return;
      }

      const publicDir = resolve(
        nitro.options.output.dir,
        nitro.options.output.publicDir || "public",
      );

      nitro.hooks.hook("prerender:done", async () => {
        await genMarkdown(publicDir);
      });

      nitro.hooks.hook("compiled", async () => {
        if (nitro.options.preset.includes("vercel")) {
          // https://vercel.com/docs/build-output-api/configuration#routes
          const vcJSON = resolve(nitro.options.output.dir, "config.json");
          const vcConfig = JSON.parse(await readFile(vcJSON, "utf8"));
          vcConfig.routes.unshift(
            {
              src: "^/$",
              dest: "/llms.txt",
              has: [{ type: "header", key: "accept", value: "(.*)text/markdown(.*)" }],
            },
            {
              src: "^/$",
              dest: "/llms.txt",
              has: [{ type: "header", key: "user-agent", value: "curl/.*" }],
            },
            {
              src: "^/([^.]+)$",
              dest: "/raw/$1.md",
              has: [{ type: "header", key: "accept", value: "(.*)text/markdown(.*)" }],
              check: true,
            },
            {
              src: "^/([^.]+)$",
              dest: "/raw/$1.md",
              has: [{ type: "header", key: "user-agent", value: "curl/.*" }],
              check: true,
            },
          );
          await writeFile(vcJSON, JSON.stringify(vcConfig, null, 2), "utf8");
        }
      });
    },
  };
}

export async function genMarkdown(publicDir) {
  // Find all .html files recursively using native Node.js globbing
  const htmlFiles = [];
  for await (const htmlFile of glob("**/*.html", { cwd: publicDir })) {
    htmlFiles.push(htmlFile);
  }

  for (const htmlFile of htmlFiles) {
    // Construct the markdown path: <dir>/raw/<path>.md
    const mdPath = join(publicDir, "raw", htmlFile.replace(/\.html$/, ".md"));

    // Skip if markdown file already exists
    if (existsSync(mdPath)) {
      continue;
    }

    // If <dir>/llms.txt exists, just copy it as markdown
    if (htmlFile === "index.html") {
      const llmsTxtPath = join(publicDir, dirname(htmlFile), "llms.txt");
      if (existsSync(llmsTxtPath)) {
        const llmsContent = await readFile(llmsTxtPath, "utf-8");
        await mkdir(dirname(mdPath), { recursive: true });
        await writeFile(mdPath, llmsContent, "utf-8");
        console.log(`Copied llms.txt to: ${mdPath}`);
        continue;
      }
    }

    // Read HTML content
    const htmlPath = join(publicDir, htmlFile);
    const htmlContent = await readFile(htmlPath, "utf-8");

    // Handle redirect pages specially
    const redirectUrl = extractRedirectUrl(htmlContent);
    const markdownContent = redirectUrl
      ? `[@${redirectUrl.replace(/^\//, "")}.md](/raw${redirectUrl}.md)\n`
      : await htmlToMarkdown(htmlContent);

    // Ensure the directory exists
    await mkdir(dirname(mdPath), { recursive: true });

    // Write markdown file (PoC: just copy HTML content)
    await writeFile(mdPath, markdownContent, "utf-8");

    console.log(`Generated: ${mdPath}`);
  }
}

function extractRedirectUrl(html) {
  const match = html.match(
    /<meta\s+http-equiv=["']?refresh["']?\s+content=["']?\d+;\s*url=([^"'>\s]+)["']?\s*\/?>/i,
  );
  return match?.[1];
}
