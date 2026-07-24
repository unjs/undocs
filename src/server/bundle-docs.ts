import type { NitroModule } from "nitro/types";
import { resolve, join, dirname } from "node:path";
import { mkdir, copyFile, glob } from "node:fs/promises";

// TEMPORARY: `runtimeConfig.undocs.dir` is an absolute path baked at build time,
// so it won't exist on deploy. Copy `.md`/`.yml` into `<output>/server/docs` at
// the `compiled` hook so `store.ts` has a fallback anywhere. Remove once content
// is embedded properly (see AGENTS.md).
export function bundleDocs(dir: string): NitroModule {
  return {
    name: "bundle-docs",
    setup(nitro) {
      if (nitro.options.dev) {
        return;
      }

      nitro.hooks.hook("compiled", async () => {
        const dest = resolve(nitro.options.output.serverDir, "docs");
        let count = 0;
        // Mirror the builder's scan: all `.md`/`.yml`, minus build artefacts.
        for await (const f of glob("**/*.{md,yml}", { cwd: dir })) {
          const rel = f.split("\\").join("/");
          if (/(^|\/)(node_modules|dist|\.docs)\//.test(rel)) {
            continue;
          }
          const to = join(dest, rel);
          await mkdir(dirname(to), { recursive: true });
          await copyFile(join(dir, rel), to);
          count++;
        }
        console.log(`Bundled ${count} docs files -> ${dest}`);
      });
    },
  };
}
