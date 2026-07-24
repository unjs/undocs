import type { NitroModule } from "nitro/types";

// Relocate the build output into the DOCS project instead of the undocs package.
//
// `rootDir` must stay `pkgRoot` (needed for config discovery and to resolve
// `vite` as undocs's own dep, not the docs project's), so Nitro derives
// `output.dir` under `pkgRoot/.output` by default. Instead of repointing
// `rootDir` (which would break both of the above), we let the preset compute
// its output paths as usual, then rebase their BASE from `pkgRoot` to
// `docsDir` — preserving the preset's shape, no hardcoded `output.*` override.
//
// Runs in `setup`, before any `compiled` hook, so `bundle-docs` / `vercel`
// (which read `output.*` in `compiled`) always see the rebased paths.
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
