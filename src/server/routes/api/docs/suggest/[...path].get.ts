import { defineEventHandler, getRouterParam } from "nitro/h3";
import { withLeadingSlash } from "ufo";
import { getIndex } from "../../../../content/store.ts";
import { suggestPages } from "../../../../content/suggest.ts";

// Path-addressed like `page/`, so the `/**` ISR rule caches it per path without
// a `passQuery` entry. The client asks only after a page 404s.
export default defineEventHandler(async (event) => {
  const slug = (
    getRouterParam(event, "path") || event.url.pathname.replace(/^\/api\/docs\/suggest\//, "")
  ).replace(/\.json$/, "");
  return suggestPages(await getIndex(), withLeadingSlash(slug));
});
