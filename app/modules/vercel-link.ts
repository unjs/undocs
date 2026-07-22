import type { NitroModule } from "nitropack";
import { resolve } from "node:path";
import { symlink, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

import { defineNuxtModule } from "nuxt/kit";

export default defineNuxtModule((_options, nuxt) => {
  const linkDirs = [nuxt.options.rootDir, nuxt.options.workspaceDir];
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
        // so the `.vercel` directory is its parent.
        const vercelDir = resolve(nitro.options.output.dir, "..");

        for (const dir of new Set(linkDirs)) {
          const target = resolve(dir, ".vercel");
          if (target === vercelDir) {
            continue;
          }
          if (existsSync(target)) {
            await rm(target, { recursive: true, force: true });
          }
          await symlink(vercelDir, target, "dir");
          console.log(`Linked ${target} -> ${vercelDir}`);
        }
      });
    },
  };
}
