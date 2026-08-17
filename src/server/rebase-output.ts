import type { NitroModule } from "nitro/types";

// Keep `rootDir` at pkgRoot for config/dependency resolution; rebase preset-derived
// output paths during setup, before compiled hooks consume them.
export function rebaseOutput(docsDir: string): NitroModule {
  return {
    name: "undocs:rebase-output",
    setup(nitro) {
      const from = nitro.options.rootDir.replace(/\/$/, "");
      const to = docsDir.replace(/\/$/, "");
      if (from === to) {
        return;
      }

      for (const key of ["dir", "publicDir", "serverDir"] as const) {
        const p = nitro.options.output[key];
        if (p && (p === from || p.startsWith(from + "/"))) {
          nitro.options.output[key] = to + p.slice(from.length);
        }
      }
    },
  };
}
