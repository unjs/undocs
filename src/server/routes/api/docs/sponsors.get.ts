import { defineEventHandler, HTTPError } from "nitro/h3";
import { $fetch } from "ofetch";
import { useRuntimeConfig } from "nitro/runtime-config";

/**
 * Proxy for the external sponsors JSON API (`docs.sponsors.api`).
 *
 * The client used to `$fetch` the third-party host directly, which fails on any
 * network/CORS/host issue. Routing it through here keeps the client same-origin
 * and lets us serve the last-good payload when the upstream is unreachable, so a
 * transient outage never blanks the sponsors section.
 */

// Module-level cache is safe here: this is server-only route code, not per-request
// render state, and the payload is identical for every visitor.
let cached: { data: unknown; at: number } | undefined;
const MAX_AGE_MS = 5 * 60 * 1000; // serve fresh from upstream at most this often

export default defineEventHandler(async (event) => {
  const api = (useRuntimeConfig().undocs as { sponsorsAPI?: string }).sponsorsAPI;
  if (!api) {
    throw new HTTPError({ status: 404, statusText: "Sponsors API not configured" });
  }

  const now = Date.now();
  if (cached && now - cached.at < MAX_AGE_MS) {
    event.res.headers.set("Cache-Control", "public, max-age=300");
    return cached.data;
  }

  try {
    const data = await $fetch(api);
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
      statusText: "Failed to fetch sponsors",
      message: (error as Error)?.message,
    });
  }
});
