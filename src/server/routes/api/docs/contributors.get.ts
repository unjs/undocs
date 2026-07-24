import { defineEventHandler, HTTPError } from "nitro/h3";
import { $fetch } from "ofetch";
import { useRuntimeConfig } from "nitro/runtime-config";

/**
 * Proxy for the external contributors API (ungh.cc), keyed off the `docs.github`
 * (`owner/repo`) slug.
 *
 * The client used to `$fetch` ungh.cc directly, which meant the request always
 * ran in the browser (client-only) and any network/CORS/host issue blanked the
 * contributors section. Routing it through here keeps the client same-origin,
 * lets the section render during SSR, and serves the last-good payload when the
 * upstream is unreachable so a transient outage never blanks it.
 */

// Module-level cache is safe here: this is server-only route code, not per-request
// render state, and the payload is identical for every visitor.
let cached: { data: unknown; at: number } | undefined;
const MAX_AGE_MS = 5 * 60 * 1000; // serve fresh from upstream at most this often

export default defineEventHandler(async (event) => {
  const github = (useRuntimeConfig().undocs as { github?: string }).github;
  if (!github) {
    throw new HTTPError({ status: 404, statusText: "GitHub repo not configured" });
  }

  const now = Date.now();
  if (cached && now - cached.at < MAX_AGE_MS) {
    event.res.headers.set("Cache-Control", "public, max-age=300");
    return cached.data;
  }

  try {
    const data = await $fetch(`https://ungh.cc/repos/${github}/contributors`);
    cached = { data, at: now };
    event.res.headers.set("Cache-Control", "public, max-age=300");
    return data;
  } catch (error) {
    // Upstream failed — fall back to the last-good payload if we have one.
    if (cached) {
      event.res.headers.set("Cache-Control", "public, max-age=60");
      return cached.data;
    }
    throw new HTTPError({
      status: 502,
      statusText: "Failed to fetch contributors",
      message: (error as Error)?.message,
    });
  }
});
