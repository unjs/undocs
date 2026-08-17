import type { NitroModule } from "nitro/types";
import { resolve } from "node:path";
import { readFile, writeFile, symlink, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

// Vercel compiled hook adds markdown negotiation and links nested output into
// each possible project root.
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

  // Nitro marks `/_undocs/*` immutable before filesystem lookup. Terminate misses
  // immediately after that lookup with `no-store`, or ISR can cache a transient
  // deployment 404 for a year.
  const fsPhase = vcConfig.routes.findIndex((r: { handle?: string }) => r.handle === "filesystem");
  if (fsPhase !== -1) {
    vcConfig.routes.splice(fsPhase + 1, 0, {
      src: "^/_undocs/(?:.*)$",
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }

  await writeFile(vcJSON, JSON.stringify(vcConfig, null, 2), "utf8");
}

// Link nested `.vercel` and static output into every candidate project root.
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
