import { watch } from "node:fs";
import { useRuntimeConfig } from "nitro/runtime-config";
import { definePlugin as defineNitroPlugin } from "nitro";
import { invalidateIndex } from "./content/store";
import { broadcastReload } from "./dev-reload";

// Dev-only Nitro plugin: watches the docs dir and, on a Markdown/YAML change,
// drops the cached content index + tells connected browsers to refresh. Only
// registered in `nitro.config.ts` when NODE_ENV !== "production".
export default defineNitroPlugin((_nitro) => {
  const config = useRuntimeConfig();
  const dir = (config.undocs || {}).dir as string | undefined;
  if (!dir) {
    return;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      invalidateIndex();
      broadcastReload();
    }, 100);
  };

  try {
    watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const name = String(filename);
      if (name.endsWith(".md") || name.endsWith(".yml")) {
        schedule();
      }
    });
  } catch {
    // recursive watch may be unsupported on some platforms; ignore.
  }
});
