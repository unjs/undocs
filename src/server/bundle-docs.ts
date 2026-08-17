import type { NitroModule } from "nitro/types";
import { resolve, join, dirname } from "node:path";
import { mkdir, copyFile, glob } from "node:fs/promises";

// TEMPORARY: the baked docs path may not exist on deploy. Bundle a server-relative
// fallback at the compiled hook; remove once content is embedded properly.
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
        // Keep exclusions synchronized with the content builder.
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
