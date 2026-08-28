import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transform } from "automd";
import { pmInstallLatest } from "../../src/server/content/automd-generators.ts";

// The real automd, not a stub: half of what this generator promises is that the
// UNflagged block still behaves exactly like automd's own `pm-i`, and that only
// holds if the delegation actually reaches it.
const URL = "https://demo.example.com";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "undocs-pm-i-"));
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ name: "demo-pkg", version: "1.2.3" }),
  );
});

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

async function run(args: string, url: string | undefined = URL) {
  const pm = pmInstallLatest(url);
  const res = await transform(
    `<!-- automd:pm-i ${args} -->\n<!-- /automd -->\n`,
    { dir, generators: { "pm-i": pm, "pm-install": pm } },
    undefined,
  );
  return { contents: res.contents, issues: res.updates.flatMap((u) => u.result.issues || []) };
}

describe("pm-i `latest`", () => {
  it("installs the tarball from the canonical url", async () => {
    const { contents, issues } = await run("latest");
    expect(issues).toEqual([]);
    expect(contents).toContain("npx nypm install https://demo.example.com/latest.tgz");
    expect(contents).toContain("npm install https://demo.example.com/latest.tgz");
    expect(contents).toContain("yarn add https://demo.example.com/latest.tgz");
    expect(contents).toContain("pnpm add https://demo.example.com/latest.tgz");
    expect(contents).toContain("bun install https://demo.example.com/latest.tgz");
    // The package NAME never appears: this installs a URL, not a registry entry.
    expect(contents).not.toContain("demo-pkg");
  });

  it("leaves deno out, since `npm:` cannot take a url", async () => {
    const { contents } = await run("latest");
    expect(contents).not.toContain("deno");
    expect(contents).not.toContain("npm:");
  });

  it("joins the url whether or not it has a trailing slash", async () => {
    const { contents } = await run("latest", "https://demo.example.com/");
    expect(contents).toContain("https://demo.example.com/latest.tgz");
    expect(contents).not.toContain("demo.example.com//latest.tgz");
  });

  it("honours dev, global, auto and separate", async () => {
    expect((await run("latest dev")).contents).toContain("npm install -D https://");
    expect((await run("latest global")).contents).toContain("npm install -g https://");
    expect((await run("latest no-auto")).contents).not.toContain("nypm");
    const separate = await run("latest separate");
    expect(separate.contents.match(/```sh/g)).toHaveLength(5);
    expect((await run("latest")).contents.match(/```sh/g)).toHaveLength(1);
  });

  // `runtimeConfig.undocs.url` is `""` when the docs config omits `url`.
  it("reports an issue when the docs have no url to install from", async () => {
    const { contents, issues } = await run("latest", "");
    expect(issues).toHaveLength(1);
    expect(contents).toContain("url");
    expect(contents).not.toContain("undefined/latest.tgz");
  });

  it("delegates a block without the flag to automd's own generator", async () => {
    const { contents, issues } = await run("");
    expect(issues).toEqual([]);
    // automd's table, from the fixture's package.json — including the deno row
    // this override drops for tarballs.
    expect(contents).toContain("npm install demo-pkg");
    expect(contents).toContain("deno install npm:demo-pkg");
    expect(contents).not.toContain("latest.tgz");
  });

  it("passes the delegated block's own args through", async () => {
    expect((await run("dev")).contents).toContain("npm install -D demo-pkg");
    expect((await run("version")).contents).toContain("demo-pkg@^1.2.3");
    expect((await run("name=other-pkg")).contents).toContain("npm install other-pkg");
  });
});
