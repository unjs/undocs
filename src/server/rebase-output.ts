import type { NitroModule } from "nitro/types";

// Keep `rootDir` at pkgRoot for config/dependency resolution; rebase preset-derived
// output paths during setup, before compiled hooks consume them.
export function rebaseOutput(docsDir: string): NitroModule {
  return {
    name: "undocs:rebase-output",
    setup(nitro) {
      const from = nitro.options.rootDir.replace(/\\/g, "/").replace(/\/$/, "");
      const to = docsDir.replace(/\\/g, "/").replace(/\/$/, "");
      if (from === to) {
        return;
      }

      for (const key of ["dir", "publicDir", "serverDir"] as const) {
        const raw = nitro.options.output[key];
        const p = raw ? raw.replace(/\\/g, "/") : "";
        if (p && (p === from || p.startsWith(from + "/"))) {
          nitro.options.output[key] = to + p.slice(from.length);
        }
      }
    },
  };
}
