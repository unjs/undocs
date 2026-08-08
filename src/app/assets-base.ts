/**
 * Public URL prefix of the hashed client bundle.
 *
 * The source of truth is `build.assetsDir` in `vite.config.ts` (`"_undocs"`);
 * this is the runtime spelling of it, shared by the code that has to recognise
 * a bundle URL: `entry-server.ts` (404s unknown asset paths without rendering)
 * and `inline/asset-recovery.ts` (reloads when a document outlives its build).
 * Keep the three in step.
 */
export const ASSETS_BASE = "/_undocs/";
