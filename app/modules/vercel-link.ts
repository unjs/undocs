import type { NitroModule } from "nitropack";
import { resolve } from "node:path";
import { symlink, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

import { defineNuxtModule } from "nuxt/kit";

export default defineNuxtModule((_options, nuxt) => {
  const rootDir = nuxt.options.rootDir;
  const linkDirs = [rootDir, nuxt.options.workspaceDir];
  nuxt.options.nitro!.modules ??= [];
  nuxt.options.nitro!.modules.push(vercelLink(rootDir, linkDirs));
});

function vercelLink(rootDir: string, linkDirs: string[]): NitroModule {
  return {
    name: "vercel-link",
    setup(nitro) {
      if (nitro.options.dev || !nitro.options.preset.includes("vercel")) {
        return;
      }

      nitro.hooks.hook("compiled", async () => {
        // For the vercel preset `output.dir` is the nested `.vercel/output`,
        // so the `.vercel` directory is its parent.
        const vercelDir = resolve(nitro.options.output.dir, "..");

        // Expose the nested `.vercel` directory at the root and workspace.
        for (const dir of new Set(linkDirs)) {
          await link(vercelDir, resolve(dir, ".vercel"));
        }

        // Expose the static output as `dist` at the root.
        await link(resolve(nitro.options.output.dir, "static"), resolve(rootDir, "dist"));
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
