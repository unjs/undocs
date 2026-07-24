/**
 * Icon SSR bridge — makes Iconify icons server-render and hydrate cleanly.
 *
 * `@iconify/vue` resolves icon data asynchronously from the Iconify HTTP API, so
 * it can't render real `<svg>`s during a single synchronous SSR pass (see
 * `components/global/Icon.vue`). To server-render icons (and avoid hydration
 * mismatches) the render is done in two passes:
 *
 *   1. `Icon.vue` registers every icon it renders via `registerServerIcon`
 *      (keyed on the per-request context), so `entry-server.ts` learns the set;
 *   2. `entry-server.ts` `loadIcon`s them and re-renders — now the SVGs resolve;
 *   3. the resolved icon data is serialized into the hydration payload; and
 *   4. `seedClientIcons` seeds it into the client's Iconify storage BEFORE mount,
 *      so the client's first render matches the server's.
 *
 * `isIconSeeded` (client) reports membership of the *seeded* set only — NOT
 * Iconify's full storage. An icon the browser happens to have cached in
 * localStorage but the server did not seed is treated as not-ready and routed
 * through `Icon.vue`'s mount-gated fallback, so it can never render ahead of the
 * server (the exact cause of the original mismatch).
 *
 * Browser-safe: no node-only imports. `registerServerIcon` reaches the active
 * per-request context through the global accessor installed by
 * `ssr/server-context.ts`; its only call site is a server-only branch in
 * `Icon.vue` that is dead-code-eliminated from the client bundle.
 */
import { addIcon, type IconifyIcon } from "@iconify/vue";
import builtinIcons from "virtual:undocs/builtin-icons";

/** Record an icon name (`collection:name`) requested during the current SSR render. */
export function registerServerIcon(name: string): void {
  if (!name) return;
  const ctx = (globalThis as any).__undocsServerCtx?.();
  ctx?.icons?.add(name);
}

/** The icon names seeded into the client's Iconify storage from the payload. */
const seededIcons = new Set<string>();

/** Seed server-resolved icon data into Iconify storage before hydration. */
export function seedClientIcons(icons: Record<string, unknown> | undefined): void {
  if (!icons) return;
  for (const [name, data] of Object.entries(icons)) {
    if (!data) continue;
    addIcon(name, data as IconifyIcon);
    seededIcons.add(name);
  }
}

/** Whether `name` was seeded by the server (so it renders identically on hydrate). */
export function isIconSeeded(name: string): boolean {
  return seededIcons.has(name);
}

/**
 * Seed undocs' BUILT-IN icons (`virtual:undocs/builtin-icons`) into Iconify
 * storage. These are shipped in the bundle, not fetched from the Iconify API, so
 * they resolve with no network on either side:
 *   - server: call once at module load — puts them in (process-global) storage so
 *     the first render already emits real SVGs (`iconLoaded` true, no CDN fetch);
 *   - client: call before mount — `addIcon` + `seededIcons` membership makes the
 *     first render treat them as ready (`isIconSeeded` true), matching the server.
 * Idempotent and visitor-independent, so a one-time server call is safe (it does
 * NOT touch per-request state). Built-in icons are also excluded from the page
 * payload — the client already has them (see `entry-server.ts`).
 */
export function seedBuiltinIcons(): void {
  for (const [name, data] of Object.entries(builtinIcons)) {
    addIcon(name, data as IconifyIcon);
    seededIcons.add(name);
  }
}

/** Full ids of the built-in icons — used to exclude them from the page payload. */
export const builtinIconNames: ReadonlySet<string> = new Set(Object.keys(builtinIcons));
