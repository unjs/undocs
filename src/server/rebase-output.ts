import type { NitroModule } from "nitro/types";

// Keep `rootDir` at pkgRoot for config/dependency resolution; rebase preset-derived
// output paths during setup, before compiled hooks consume them.
export function rebaseOutput(docsDir: string): NitroModule {
  return {
    name: "undocs:rebase-output",
    setup(nitro) {
      const from = normalizePath(nitro.options.rootDir).replace(/\/$/, "");
      const to = normalizePath(docsDir).replace(/\/$/, "");

      for (const key of ["dir", "publicDir", "serverDir"] as const) {
        const raw = nitro.options.output[key];
        if (!raw) {
          continue;
        }
        const p = normalizePath(raw);
        if (from !== to && (p === from || p.startsWith(from + "/"))) {
          nitro.options.output[key] = to + p.slice(from.length);
        } else {
          nitro.options.output[key] = p;
        }
      }
    },
  };
}

// Same shape as pathe's `normalizeWindowsPath`, which Nitro's `join` applies to
// the prerender file path it then `startsWith`-checks against `publicDir`: forward
// slashes AND an uppercase drive letter (`path.resolve` keeps a lowercase `c:`
// from the cwd), or every route is skipped.
function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^[a-z]:\//, (d) => d.toUpperCase());
}
