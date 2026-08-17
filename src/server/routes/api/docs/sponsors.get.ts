import { defineEventHandler, HTTPError } from "nitro/h3";
import { $fetch } from "ofetch";
import { useRuntimeConfig } from "nitro/runtime-config";

// Same-origin SSR proxy with last-good recovery from transient upstream failures.

// Server-only, visitor-independent cache.
let cached: { data: unknown; at: number } | undefined;
const MAX_AGE_MS = 5 * 60 * 1000;

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
