import type { Generator } from "automd";
import { joinURL } from "ufo";
import { PKG_TARBALL } from "../pack-pkg.ts";

// Package managers that can install a tarball URL, in automd's own `pm-i`
// order. `deno` is absent on purpose: automd's table installs through `npm:`,
// a registry specifier a URL cannot follow.
const INSTALL_COMMANDS: [pm: string, install: string][] = [
  ["npm", "install"],
  ["yarn", "add"],
  ["pnpm", "add"],
  ["bun", "install"],
];

const AUTO_COMMAND: [string, string] = ["npx nypm", "install"];

/**
 * `pm-i`, plus a `latest` flag for the `pkg` tarball:
 *
 * ```md
 * <!-- automd:pm-i latest -->
 * ```
 *
 * The tarball is served from the docs site itself (`src/server/pack-pkg.ts`),
 * so the install command is only as good as the canonical `url` in the docs
 * config — there is nowhere else to learn the deployed origin from, and a
 * relative path is not installable.
 *
 * Without the flag this is automd's own `pm-i`, reached by re-running the block
 * against a generator set this override has been removed from. Delegating that
 * way rather than reimplementing it keeps ONE copy of the install table for the
 * registry case: the flag exists because a tarball URL needs a different table,
 * not a different generator.
 */
export function pmInstallLatest(url: string | undefined): Generator {
  return {
    name: "pm-install",
    async generate({ args, config, block, url: fileURL }) {
      if (!args.latest) {
        const generators = { ...config.generators };
        delete generators["pm-i"];
        delete generators["pm-install"];
        const { transform } = await import("automd");
        const res = await transform(
          `<!-- automd:pm-i ${block.rawArgs} -->\n<!-- /automd -->`,
          { ...config, generators },
          fileURL,
        );
        return res.updates[0]?.result || { contents: "" };
      }

      if (!url) {
        const issue = "`latest` needs the docs `url` to build an install command";
        return { contents: `<!-- ⚠️  (pm-i) ${issue} -->`, issues: [issue] };
      }

      const tarball = joinURL(url, PKG_TARBALL);
      const flag = args.dev ? " -D" : args.global ? " -g" : "";
      const commands = (
        args.auto === false ? INSTALL_COMMANDS : [AUTO_COMMAND, ...INSTALL_COMMANDS]
      ).map(([pm, install]) => {
        const label = pm.includes("nypm") ? "✨ Auto-detect" : pm;
        return `# ${label}\n${pm} ${install}${flag} ${tarball}`;
      });

      const block_ = (code: string) => "```sh\n" + code + "\n```";
      return {
        contents: args.separate
          ? commands.map((command) => block_(command)).join("\n\n")
          : block_(commands.join("\n\n")),
      };
    },
  };
}
