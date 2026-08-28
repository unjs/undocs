import type { NitroModule } from "nitro/types";
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rename, rm } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { promisify } from "node:util";
import { detectPackageManager, runScript } from "nypm";

const exec = promisify(execFile);

// The tarball always uses this URL so links do not change between deployments.
export const PKG_TARBALL = "latest.tgz";

// Child builds may start another docs build. This flag stops that build from
// packing the package again and causing an endless loop.
const SKIP = "UNDOCS_SKIP_PACK";

/**
 * Build the configured package and serve its tarball with the site.
 *
 * Package paths are relative to the docs directory. `true` selects `..`.
 * During a production build, this module runs the package's `build` script if
 * it has one. It then runs `npm pack` and serves the result at `/latest.tgz`.
 *
 * This work runs in `build:before` so the tarball exists when Nitro copies
 * public files. It does not run in dev. The temporary directory contains only
 * the tarball because Nitro serves the whole directory from the site root.
 */
export function packPkg(docsDir: string, pkg: string | boolean | undefined): NitroModule {
  return {
    name: "pack-pkg",
    setup(nitro) {
      if (!pkg || nitro.options.dev || process.env[SKIP]) {
        return;
      }

      const pkgDir = resolve(docsDir, pkg === true ? ".." : pkg);

      nitro.hooks.hook("build:before", async () => {
        const dir = resolve(nitro.options.buildDir, "undocs/pkg");
        await rm(dir, { recursive: true, force: true });
        await mkdir(dir, { recursive: true });

        const manifest = await readManifest(pkgDir);
        const name = manifest.name || relative(docsDir, pkgDir) || pkgDir;

        // `rootDir` is the undocs package, so a match means undocs is packing
        // itself (this repo's own `docs/`). Its `build` script IS this build and
        // shares the same `buildDir` and output dir, so running it nested breaks
        // the outer build; undocs also ships source, so nothing needs building.
        //
        // A package does not need a `build` script to be packed.
        if (pkgDir === resolve(nitro.options.rootDir)) {
          nitro.logger.info(`Packing \`${name}\` as-is (its build script is this build)`);
        } else if (manifest.scripts?.build) {
          nitro.logger.start(`Building \`${name}\``);
          // Use npm when nypm cannot find a package manager.
          const packageManager = (await detectPackageManager(pkgDir)) || "npm";
          await runScript("build", { cwd: pkgDir, packageManager, env: { [SKIP]: "1" } });
        }

        // Always use `npm pack` so the output format is consistent. Write the
        // tarball to the temporary directory instead of the package directory.
        await exec(
          process.platform === "win32" ? "npm.cmd" : "npm",
          ["pack", "--pack-destination", dir],
          { cwd: pkgDir, env: { ...process.env, [SKIP]: "1" } },
        );

        // The temporary directory was empty before `npm pack` ran.
        const tarball = (await readdir(dir)).find((file) => file.endsWith(".tgz"));
        if (!tarball) {
          throw new Error(`\`npm pack\` produced no tarball for \`${name}\` (${pkgDir})`);
        }
        await rename(resolve(dir, tarball), resolve(dir, PKG_TARBALL));

        nitro.options.publicAssets.push({ dir, maxAge: 0, baseURL: "/", fallthrough: true });
        // Nitro does not know the `.tgz` type and otherwise uses `text/plain`.
        nitro.options.routeRules[`/${PKG_TARBALL}`] = {
          headers: { "content-type": "application/gzip" },
        };
        nitro.logger.success(`Packed \`${name}\` (${tarball}) -> /${PKG_TARBALL}`);
      });
    },
  };
}

async function readManifest(
  pkgDir: string,
): Promise<{ name?: string; scripts?: Record<string, string> }> {
  try {
    return JSON.parse(await readFile(resolve(pkgDir, "package.json"), "utf8"));
  } catch (error) {
    throw new Error(`Cannot read \`package.json\` of \`pkg\` dir \`${pkgDir}\``, { cause: error });
  }
}
