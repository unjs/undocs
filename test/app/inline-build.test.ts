import { describe, it, expect } from "vitest";
import { buildInline, readArtifact } from "../../scripts/build-inline.mjs";

/**
 * Drift guard for `src/app/inline/*`.
 *
 * The `.js` artifacts are committed and shipped verbatim (see
 * `src/app/inline/README.md`), so nothing at build or request time would notice
 * an artifact that no longer matches its `.ts` source — the stale bytes would
 * simply keep going out on every HTML response. This runs the real build
 * (`scripts/build-inline.mjs`, the same code `pnpm build:inline` runs) and
 * compares, so editing a source without regenerating fails the suite.
 */
describe("inline programs", () => {
  it("have committed artifacts matching their sources", async () => {
    const built = await buildInline();
    expect(built.length).toBeGreaterThan(0);

    for (const { name, code } of built) {
      const current = await readArtifact(name);
      expect(current, `${name}.js is missing — run \`pnpm build:inline\``).not.toBeNull();
      expect(current, `${name}.js is out of date — run \`pnpm build:inline\``).toBe(code);
    }
  });

  it("emit a self-contained iife that is safe to inline in a <script>", async () => {
    for (const { name, code } of await buildInline()) {
      // Every byte ships on every HTML response, so the artifact carries no
      // banner and no comments — not even a generated-file header.
      expect(code, `${name}: leaks a comment into every page`).not.toMatch(/^\s*\/\//m);
      // An `import`/`export` left in the bundle would throw in a classic script.
      expect(code, `${name}: not fully bundled`).not.toMatch(/^\s*(import|export)\s/m);
      // Either of these would terminate the host <script> tag early.
      expect(code, `${name}: would close its own script tag`).not.toContain("</script");
      expect(code, `${name}: contains an HTML comment opener`).not.toContain("<!--");
      // A sourcemap comment would 404 in the browser (the map is never emitted).
      expect(code, `${name}: leaks a sourcemap comment`).not.toContain("sourceMappingURL");
    }
  }, 20_000);
});
