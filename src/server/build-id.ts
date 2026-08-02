import type { NitroModule } from "nitro/types";

/** Where the current build id is served, and the key it is exposed under. */
export const BUILD_MANIFEST_ROUTE = "/_build.json";

/**
 * Build identity — the signal for "has the server been redeployed since this
 * page loaded?".
 *
 * Every other recovery path in undocs is REACTIVE: it waits for an asset to 404
 * and then reacts (`vite:preloadError` in `main.ts`, the `cache: "reload"` retry
 * in `public/sw.js`, the inline guard in `entry-server.ts`). By then the page is
 * already broken, and the failure is ambiguous — a missing chunk looks the same
 * whether the build moved on or the network simply failed. This is the positive
 * signal instead: `entry-server.ts` inlines the build that rendered a document
 * into its payload, and this route reports the one the server is on now. A
 * disagreement means a redeploy, known before anything 404s.
 *
 * The id is Nitro's own `manifest.deploymentId`: each preset fills it from its
 * host's variable (vercel → `VERCEL_DEPLOYMENT_ID`, netlify → `DEPLOY_ID`,
 * deno-deploy → `DENO_DEPLOYMENT_ID`, aws-amplify → `AWS_JOB_ID`), and a project
 * can set it explicitly in `nitro.config.ts`. Taking it from Nitro rather than
 * re-reading env means new presets and an explicit override both work for free.
 *
 * Self-contained on purpose: the route is a virtual module registered as a
 * handler, so no file exists on disk for it and the client build needs to know
 * nothing about it. `runtimeConfig` carries the same value to the SSR renderer,
 * so both sides of the comparison have one source — if they could disagree, a
 * prerendered page would report itself stale forever.
 */
export function buildId(): NitroModule {
  return {
    name: "undocs:build-id",
    setup(nitro) {
      // A build runs this module against TWO Nitro instances: the real preset,
      // and the `nitro-prerender` one that bakes the static pages. The prerender
      // instance does not inherit `manifest`, so left alone it would mint its own
      // id — and every prerendered page would then disagree with the route below
      // forever, reporting itself stale on first load. So the first resolved id
      // wins and both instances reuse it, memoised through `process.env`: a real
      // process global, which a module-scope variable is not here (the two config
      // loads may not share a module registry).
      //
      // Presets that know their deployment win. The timestamp fallback covers
      // self-hosted presets (node-server, bun, …) that have no deployment
      // identity: every build gets a fresh id, so an open tab is told to reload
      // even when the output happens to be byte-identical. That is the safe
      // direction to err in — a redundant reload costs a cached round-trip,
      // a missed one leaves a broken page.
      const MEMO = "UNDOCS_RESOLVED_BUILD_ID";
      const id = process.env[MEMO] || nitro.options.manifest?.deploymentId || `build-${Date.now()}`;
      process.env[MEMO] = id;

      // Reaches the SSR renderer (`entry-server.ts`), which inlines it into the
      // hydration payload. Same value as the route below, by construction.
      const undocs = (nitro.options.runtimeConfig.undocs ??= {} as Record<string, unknown>);
      (undocs as Record<string, unknown>).buildId = id;

      // The route itself, as a virtual module — nothing on disk, nothing for
      // `serverDir` scanning to find.
      const virtualId = "#undocs/build-id";
      nitro.options.virtual[virtualId] = /* js */ `
import { defineHandler } from "nitro/h3";
export default defineHandler(() => ({ buildId: ${JSON.stringify(id)} }));
`;
      nitro.options.handlers.push({
        route: BUILD_MANIFEST_ROUTE,
        method: "GET",
        handler: virtualId,
      });

      // Prerendered so the common case is a static file rather than a function
      // invocation — the id is fixed for the life of the build, so there is
      // nothing to compute per request.
      (nitro.options.prerender.routes ??= []).push(BUILD_MANIFEST_ROUTE);

      // `no-store` is the whole point: a cached copy would report the build the
      // CLIENT already has, which is exactly the comparison it is trying to
      // make. Also opts out of the `/**` ISR default for the same reason.
      nitro.options.routeRules[BUILD_MANIFEST_ROUTE] = {
        ...nitro.options.routeRules[BUILD_MANIFEST_ROUTE],
        isr: false,
        headers: { "cache-control": "no-store" },
      };
    },
  };
}
