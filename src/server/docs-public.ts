import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Where a docs project keeps its static assets, in OVERRIDE order: `.docs/public`
// (the docs-specific override dir) first, then a plain `public/` for projects
// that keep assets outside `.docs`. Every consumer of those dirs reads this one
// list — `nitro.config.ts` (the site-root `publicAssets` and the `og-docs`
// server-asset mount), `app-config.ts` (the `/icon.svg` logo default) and
// `vite.plugins.ts` (the dev watcher for that file) — so they cannot disagree
// about which dir a project's `icon.svg` comes from.
export function docsPublicDirs(docsDir: string): string[] {
  return [resolve(docsDir, ".docs/public"), resolve(docsDir, "public")];
}

// The candidate `/icon.svg` sources, same precedence.
export function docsIconFiles(docsDir: string): string[] {
  return docsPublicDirs(docsDir).map((dir) => resolve(dir, "icon.svg"));
}

// The project's own mark, or undefined: undocs ships no default logo, so the
// header/footer/favicon and the OG card all render nothing rather than someone
// else's mark when no project file exists.
export function resolveDocsIcon(docsDir: string): string | undefined {
  return docsIconFiles(docsDir).find((file) => existsSync(file));
}
