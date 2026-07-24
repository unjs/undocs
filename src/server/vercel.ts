import type { NitroModule } from "nitro/types";
import { resolve } from "node:path";
import { readFile, writeFile, symlink, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

// Nitro module for Vercel builds (no-op in dev / other presets). On `compiled`:
//  1. Content negotiation — prepend Build Output API `routes` so curl /
//     `Accept: text/markdown` gets markdown instead of HTML: `/` → `/llms.txt`,
//     `/<path>` → `/raw/<path>.md`, served dynamically (no prerendered `.md`).
//  2. Output linking — symlink Nitro's nested `.vercel/output` (+ static output
//     as `dist`) into each candidate root, since Vercel's "Root Directory" may
//     vary.
export function vercel(linkDirs: string[]): NitroModule {
  return {
    name: "vercel",
    setup(nitro) {
      if (nitro.options.dev || !nitro.options.preset.includes("vercel")) {
        return;
      }

      nitro.hooks.hook("compiled", async () => {
        await rewriteRoutes(nitro.options.output.dir);
        await linkOutput(nitro.options.output.dir, linkDirs);
      });
    },
  };
}

// Prepend content-negotiation routes to the Vercel Build Output config.
// https://vercel.com/docs/build-output-api/configuration#routes
async function rewriteRoutes(outputDir: string) {
  const vcJSON = resolve(outputDir, "config.json");
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

// Expose the nested `.vercel` and static output (as `dist`) at both the root
// and the workspace so Vercel can find them regardless of the configured
// project root directory. For the vercel preset `output.dir` is the nested
// `.vercel/output`, so the `.vercel` directory is its parent and the static
// output lives in `.vercel/output/static`.
async function linkOutput(outputDir: string, linkDirs: string[]) {
  const vercelDir = resolve(outputDir, "..");
  const staticDir = resolve(outputDir, "static");

  for (const dir of new Set(linkDirs)) {
    await link(vercelDir, resolve(dir, ".vercel"));
    await link(staticDir, resolve(dir, "dist"));
  }
}

async function link(source: string, target: string) {
  if (target === source) {
    return;
  }
  if (existsSync(target)) {
    await rm(target, { recursive: true, force: true });
  }
  await symlink(source, target, "dir");
  console.log(`Linked ${target} -> ${source}`);
}
