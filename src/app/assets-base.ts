/**
 * Public URL prefixes of the hashed client bundle.
 *
 * Two, because the dir is not ours alone to choose: `vite.config.ts` asks for
 * `_undocs`, but Vercel's `immutableStaticFiles` (`src/server/vercel.ts`)
 * repoints the whole bundle at `_vercel/immutable/<salt>/undocs` — the only path
 * that host serves from its cross-deployment store. Listing the RESERVED
 * `/_vercel/immutable/` prefix rather than the exact dir inside it keeps this a
 * plain constant: no build plumbing to thread the resolved `assetsDir` into the
 * client, and nothing to drift when the salt or framework name changes.
 *
 * Read by `entry-server.ts`, which 404s these paths instead of rendering the SPA
 * for a bundle file that is no longer there. `utils/routes.ts` denies the same
 * two prefixes as part of its wider server denylist.
 */
const ASSET_PREFIXES = ["/_undocs/", "/_vercel/immutable/"];

/** Is this pathname a built bundle file (or a miss where one used to be)? */
export function isAssetPath(pathname: string): boolean {
  return ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
