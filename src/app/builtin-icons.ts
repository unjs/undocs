/**
 * Built-in icon allowlist — the icons undocs' own UI + default theme reference,
 * bundled from local Iconify collections instead of fetched from the Iconify
 * HTTP API (`https://api.iconify.design`) at runtime.
 *
 * WHY a curated list (not a build-time scan): it is explicit, reviewable, and
 * ships only the geometry actually used (a scan of `.vue` templates can't see
 * dynamically-composed names). The `undocs:builtin-icons` Vite plugin reads THIS
 * file, extracts each name from the matching `@iconify-json/<collection>` package
 * with `@iconify/utils`, and serves the resolved data as the virtual module
 * `virtual:undocs/builtin-icons`. That module is seeded into Iconify storage on
 * BOTH the server (before render) and the client (before mount), so these icons
 * render synchronously with zero network — see `ssr/icons.ts` / `entry-server.ts`.
 *
 * Keep it in sync: an icon referenced in code but MISSING here still works — it
 * just falls back to the Iconify HTTP API (the pre-bundle behavior). Only the two
 * collections below are bundled for now. `simple-icons` (brand logos: github,
 * openai, anthropic, … — no lucide equivalent) is still fetched from the HTTP API
 * and is the next collection to migrate here.
 *
 * Names are the collection-local icon names (no `i-` prefix, no `collection:`).
 */
export const BUILTIN_ICONS: Record<string, string[]> = {
  lucide: [
    "arrow-right",
    "book-open",
    "bookmark",
    "check",
    "chevron-down",
    "chevron-left",
    "chevron-right",
    "cloud-off",
    "code",
    "component",
    "copy",
    "file",
    "file-text",
    "folder",
    "folder-open",
    "git-pull-request",
    "hash",
    "heart-handshake",
    "info",
    "lightbulb",
    "link",
    "loader-2",
    "loader-circle",
    "message-square-warning",
    "moon",
    "newspaper",
    "octagon-alert",
    "play",
    "puzzle",
    "rocket",
    "search",
    "search-x",
    "settings",
    "square-code",
    "square-function",
    "square-pen",
    "sun",
    "terminal",
    "triangle-alert",
    "x",
  ],
  "vscode-icons": [
    "file-type-bun",
    "file-type-config",
    "file-type-deno",
    "file-type-dotenv",
    "file-type-editorconfig",
    "file-type-eslint",
    "file-type-favicon",
    "file-type-git",
    "file-type-js",
    "file-type-markdown",
    "file-type-node",
    "file-type-npm",
    "file-type-nuxt",
    "file-type-pnpm",
    "file-type-python",
    "file-type-tailwind",
    "file-type-tsconfig",
    "file-type-typescript",
    "file-type-vscode",
    "file-type-yaml",
    "file-type-yarn",
  ],
};

/** Full `collection:name` ids of every bundled icon (e.g. `lucide:arrow-right`). */
export const BUILTIN_ICON_NAMES: string[] = Object.entries(BUILTIN_ICONS).flatMap(
  ([collection, names]) => names.map((name) => `${collection}:${name}`),
);
