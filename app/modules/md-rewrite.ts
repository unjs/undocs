import type { NitroModule } from "nitropack";
import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import { defineNuxtModule } from "nuxt/kit";

export default defineNuxtModule((_options, nuxt) => {
  nuxt.options.nitro.modules ??= [];
  nuxt.options.nitro.modules.push(mdRewrite());
});

function mdRewrite(): NitroModule {
  return {
    name: "markdown-rewrite",
    setup(nitro) {
      if (nitro.options.dev || !nitro.options.preset.includes("vercel")) {
        return;
      }
      nitro.hooks.hook("compiled", async () => {
        const vcJSON = resolve(nitro.options.output.dir, "config.json");
        const vcConfig = JSON.parse(await readFile(vcJSON, "utf8"));
        vcConfig.routes.unshift(
          {
            src: "^/docs/(.+)$",
            dest: "/raw/$1.md",
            has: [{ type: "header", key: "accept", value: "(.*)text/markdown(.*)" }],
            check: true,
          },
          {
            src: "^/docs/(.+)$",
            dest: "/raw/$1.md",
            has: [{ type: "header", key: "user-agent", value: "curl/.*" }],
            check: true,
          },
        );
        await writeFile(vcJSON, JSON.stringify(vcConfig, null, 2), "utf8");
      });
    },
  };
}
