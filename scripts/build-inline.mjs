/**
 * Compiles the inline `<head>` programs in `src/app/inline/*.ts` to the compact
 * `.js` files checked in beside them (see `src/app/inline/README.md`).
 *
 * Both the source and the output are committed: the `.ts` is what we edit,
 * review and typecheck; the `.js` is what actually ships, inlined verbatim into
 * every HTML response by `entry-server.ts` (`?raw` import). Committing the
 * output keeps the shipped bytes reviewable in a diff and keeps `vite build`
 * from needing a codegen step.
 *
 * `iife` because the result is dropped straight into a `<script>` tag: it must
 * be a complete statement that leaks no bindings into the global scope.
 *
 *   pnpm build:inline           # rewrite the .js files
 *   pnpm build:inline --check   # verify they are current (CI / the drift test)
 *
 * `buildInline()` is also imported by `test/app/inline-build.test.ts`, so the
 * drift guard runs the real build rather than a re-implementation of it.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "rolldown";

const INLINE_DIR = fileURLToPath(new URL("../src/app/inline/", import.meta.url));

/**
 * Bundle every inline entry.
 *
 * @returns {Promise<{ name: string, source: string, code: string }[]>} one entry
 * per program, `code` being the exact text that should be on disk.
 */
export async function buildInline() {
  const entries = (await readdir(INLINE_DIR)).filter((f) => f.endsWith(".ts")).sort();

  const out = [];
  for (const entry of entries) {
    const name = entry.replace(/\.ts$/, "");
    const result = await build({
      input: INLINE_DIR + entry,
      // The programs are self-contained; anything they import is inlined.
      platform: "browser",
      write: false,
      logLevel: "warn",
      output: {
        format: "iife",
        minify: true,
        // No `//# sourceMappingURL` comment — this text goes into the HTML.
        sourcemap: false,
      },
    });

    const chunk = result.output.find((o) => o.type === "chunk");
    if (!chunk) throw new Error(`[build-inline] no chunk emitted for ${entry}`);

    // No banner and no comments: this text is inlined verbatim into EVERY HTML
    // response, so every byte here is paid per page view. "Generated, do not
    // edit" lives in `src/app/inline/README.md`, and the drift test makes a
    // hand-edit fail rather than survive.
    out.push({ name, source: entry, code: chunk.code.trim() + "\n" });
  }
  return out;
}

/** Read what is currently on disk for a built entry (`null` when absent). */
export async function readArtifact(name) {
  try {
    return await readFile(`${INLINE_DIR}${name}.js`, "utf8");
  } catch {
    return null;
  }
}

// CLI only — importing this module (the drift test does) must not write files.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes("--check");
  const built = await buildInline();
  const stale = [];

  for (const { name, code } of built) {
    if ((await readArtifact(name)) === code) continue;
    stale.push(name);
    if (!check) await writeFile(`${INLINE_DIR}${name}.js`, code);
  }

  if (check && stale.length) {
    console.error(`[build-inline] out of date: ${stale.join(", ")} — run \`pnpm build:inline\``);
    process.exit(1);
  }

  const sizes = built.map(({ name, code }) => `${name}.js (${code.length} B)`).join(", ");
  console.log(
    check
      ? `[build-inline] up to date: ${sizes}`
      : `[build-inline] ${stale.length ? "wrote" : "unchanged"}: ${sizes}`,
  );
}
