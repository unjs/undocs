import { defineEventHandler, getRequestURL, redirect } from "nitro/h3";

/**
 * Rewrite `/path/to/route.md` → `/raw/path/to/route.md` via redirect, so a
 * bare `.md` URL resolves to the source-markdown route. Skips paths already
 * under `/raw/`. Query string is preserved. Runs as route middleware before
 * the matched handler (returning here closes the request).
 */
export default defineEventHandler((event) => {
  const url = getRequestURL(event);
  if (!url.pathname.endsWith(".md") || url.pathname.startsWith("/raw/")) {
    return;
  }
  return redirect(`/raw${url.pathname}${url.search}`, 302);
});
