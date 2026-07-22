import type { NitroModule } from "nitropack";
import { resolve } from "node:path";
import { symlink, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

import { defineNuxtModule } from "nuxt/kit";

export default defineNuxtModule((_options, nuxt) => {
  const rootDir = nuxt.options.rootDir;
  // Candidate roots covering any Vercel "Root Directory" project setting:
  // the nuxt rootDir (`<docs>/.docs`), the docs dir (`<docs>`) and the workspace.
  const linkDirs = [rootDir, resolve(rootDir, ".."), nuxt.options.workspaceDir];
  nuxt.options.nitro!.modules ??= [];
  nuxt.options.nitro!.modules.push(vercelLink(linkDirs));
});

function vercelLink(linkDirs: string[]): NitroModule {
  return {
    name: "vercel-link",
    setup(nitro) {
      if (nitro.options.dev || !nitro.options.preset.includes("vercel")) {
        return;
      }

      nitro.hooks.hook("compiled", async () => {
        // For the vercel preset `output.dir` is the nested `.vercel/output`,
        // so the `.vercel` directory is its parent and the static output lives
        // in `.vercel/output/static`.
        const vercelDir = resolve(nitro.options.output.dir, "..");
        const staticDir = resolve(nitro.options.output.dir, "static");

        // Expose the nested `.vercel` and static output (as `dist`) at both the
        // root and the workspace so Vercel can find them regardless of the
        // configured project root directory.
        for (const dir of new Set(linkDirs)) {
          await link(vercelDir, resolve(dir, ".vercel"));
          await link(staticDir, resolve(dir, "dist"));
        }
      });
    },
  };
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
