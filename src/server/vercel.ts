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

      // Serve the client bundle from Vercel's cross-deployment immutable store.
      // The preset acts on this in `build:before`, repointing
      // `nitro.options.buildAssetsDir` at `_vercel/immutable/<salt>/undocs`, and
      // nitro's Vite plugin then supplies that dir as the client and `ssr` name
      // patterns — which works only because `vite.config.ts` leaves those unset
      // (see the assets-dir invariant in AGENTS.md). The preset self-disables,
      // with a warning, on a real Vercel build that has not enabled the feature
      // and on a non-root `baseURL`.
      nitro.options.vercel ??= {};
      nitro.options.vercel.immutableStaticFiles = true;

      nitro.hooks.hook("compiled", async () => {
        // Read at `compiled` time, after the preset had its say. Falls back to
        // Vite's own `assetsDir` when the feature is off or self-disabled.
        await rewriteRoutes(nitro.options.output.dir, nitro.options.buildAssetsDir || "_undocs");
        await linkOutput(nitro.options.output.dir, linkDirs);
      });
    },
  };
}

// https://vercel.com/docs/build-output-api/configuration#routes
async function rewriteRoutes(outputDir: string, assetsDir: string) {
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

  // Nitro marks the bundle's own prefix immutable before the filesystem lookup —
  // from the public-asset entry for `/_undocs/`, or, once
  // `immutableStaticFiles` moved the bundle, from the preset's generated
  // `/_vercel/immutable/**` header route. Either way, terminate misses
  // immediately after that lookup with `no-store`, or ISR can cache a transient
  // deployment 404 for a year.
  const fsPhase = vcConfig.routes.findIndex((r: { handle?: string }) => r.handle === "filesystem");
  if (fsPhase !== -1) {
    vcConfig.routes.splice(fsPhase + 1, 0, {
      src: `^/${assetsDir}/(?:.*)$`,
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
