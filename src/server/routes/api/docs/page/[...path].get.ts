import { defineEventHandler, getRouterParam, HTTPError } from "nitro/h3";
import { withLeadingSlash } from "ufo";
import { useRuntimeConfig } from "nitro/runtime-config";
import { getIndex } from "../../../../content/store.ts";
import { localeOfPath } from "../../../../content/builder.ts";
import type { SurroundItem } from "../../../../content/types.ts";

export default defineEventHandler(async (event) => {
  // `.json` disambiguates a page artifact from the directory needed by nested pages.
  const slug = (
    getRouterParam(event, "path") ||
    decodeURIComponent(event.url.pathname).replace(/^\/api\/docs\/page\//, "")
  ).replace(/\.json$/, "");

  // Preserve root and legacy trailing-slash aliases.
  const path = !slug || slug === "_index" ? "/" : withLeadingSlash(slug).replace(/\/$/, "") || "/";

  const index = await getIndex();
  const page = index.byPath.get(path) || index.byPath.get(path + "/");
  if (!page) {
    throw new HTTPError({ status: 404, statusText: "Page not found", message: path });
  }

  const undocs = (useRuntimeConfig().undocs || {}) as {
    i18n?: { localeCodes?: string[]; defaultLocale?: string };
  };
  const localeCodes = undocs.i18n?.localeCodes ?? [];
  const defaultLocale = undocs.i18n?.defaultLocale ?? "en";
  const pageLocale = localeOfPath(page.path, localeCodes, defaultLocale);

  // Embed prev/next so page rendering remains one request. Stay within the same
  // locale so a Russian page never surrounds to an English neighbor.
  const at = (p: string | undefined): SurroundItem | null => {
    const neighbor = p ? index.byPath.get(p) : undefined;
    return neighbor
      ? { title: neighbor.title, description: neighbor.description, path: neighbor.path }
      : null;
  };
  const i = index.order.indexOf(page.path);
  let prev: SurroundItem | null = null;
  let next: SurroundItem | null = null;
  if (i !== -1) {
    for (let j = i - 1; j >= 0; j--) {
      const p = index.order[j]!;
      if (localeOfPath(p, localeCodes, defaultLocale) === pageLocale) {
        prev = at(p);
        break;
      }
    }
    for (let j = i + 1; j < index.order.length; j++) {
      const p = index.order[j]!;
      if (localeOfPath(p, localeCodes, defaultLocale) === pageLocale) {
        next = at(p);
        break;
      }
    }
  }
  const surround: [SurroundItem | null, SurroundItem | null] = [prev, next];

  return { ...page, surround };
});
