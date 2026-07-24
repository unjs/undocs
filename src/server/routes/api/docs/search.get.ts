import { defineEventHandler } from "nitro/h3";
import { getIndex } from "../../../content/store";

// Ships the pre-built, serialized MiniSearch index (see `builder.ts`'s
// `buildSearchIndex`). Query-less, so it's baked to a static file at prerender;
// the client rehydrates it with `MiniSearch.loadJS` and never re-indexes.
export default defineEventHandler(async () => {
  const index = await getIndex();
  return index.searchIndex;
});
