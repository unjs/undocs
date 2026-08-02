/**
 * Build identity — "has the server been redeployed since this page loaded?"
 *
 * Every other recovery path in the app is REACTIVE: it waits for an asset to
 * 404 and then reacts (`vite:preloadError` in `main.ts`, the `cache: "reload"`
 * retry in `public/sw.js`, the inline guard in `entry-server.ts`). By then the
 * page is already broken, and the failure is ambiguous — a missing chunk looks
 * the same whether the build moved on or the network simply failed.
 *
 * This is the positive signal instead. The server inlines the build that
 * rendered the document into the hydration payload, and serves the CURRENT one
 * at `/_build.json` (uncached — see `nitro.config.ts`'s route rule). A
 * disagreement means a deploy happened, known before anything 404s.
 *
 * Detection only: nothing here reloads. Deciding what to do — reload on the
 * next route change, surface a "new version available" prompt, do nothing on a
 * page with unsaved state — is the caller's call.
 */
import { readPayload } from "@app/ssr/payload";

/** Where the server reports its current build id (`entry-server.ts`). */
export const BUILD_MANIFEST = "/_build.json";

/** The build that rendered this document, or `undefined` pre-payload/in dev. */
export function currentBuildId(): string | undefined {
  return readPayload().buildId;
}

/**
 * Ask the server which build it is serving now. Resolves `undefined` when the
 * request fails or returns something unexpected — callers must treat "unknown"
 * as "no evidence of a redeploy", never as a mismatch.
 */
export async function fetchServerBuildId(): Promise<string | undefined> {
  try {
    const res = await fetch(BUILD_MANIFEST, { cache: "no-store" });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { buildId?: unknown };
    return typeof body?.buildId === "string" ? body.buildId : undefined;
  } catch {
    return undefined;
  }
}

/**
 * True only when both ids are known AND differ — i.e. the server has been
 * redeployed since this document was rendered. Unknown on either side yields
 * `false`, so a failed probe never triggers a false positive.
 */
export async function isStaleBuild(): Promise<boolean> {
  const mine = currentBuildId();
  if (!mine) return false;
  const theirs = await fetchServerBuildId();
  return !!theirs && theirs !== mine;
}
