import { defineEventHandler } from "nitro/h3";
import { getIndex } from "../../../content/store";

export default defineEventHandler(async () => {
  const index = await getIndex();
  return index.navigation;
});
