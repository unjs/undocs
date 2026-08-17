import { defineEventHandler } from "nitro/h3";
import { getIndex } from "../../../content/store.ts";

// Pre-built index lets the client rehydrate without re-indexing.
export default defineEventHandler(async () => {
  const index = await getIndex();
  return index.searchIndex;
});
