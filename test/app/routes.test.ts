import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { isAppRoute } from "../../src/app/utils/routes.ts";

// `isAppRoute` is a denylist mirroring what the SERVER answers, and its whole
// job is to keep an intercepted click off those paths — the router's catch-all
// would render a docs 404 for every one of them. A mirror drifts, so the two
// configs it copies are read here rather than trusted.

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("isAppRoute", () => {
  it("owns the docs routes", () => {
    for (const path of [
      "/",
      "/blog",
      "/blog/hello-world",
      "/guide/getting-started",
      "/guide/getting-started?utm=x#install",
      "/v1.0/api",
      // A page name may carry a dot (`docs/nuxt.config.md`), which is why the
      // file check is a closed extension list and not "has a dot".
      "/nuxt.config",
      "/docs.config",
      // A docs project with an `/api` SECTION is ordinary — a library
      // documenting its API — so only what a handler claims is denied below.
      "/api",
      "/api/config",
      "/api/utils/hash",
    ]) {
      expect(isAppRoute(path), path).toBe(true);
    }
  });

  it("leaves every Nitro handler to the server", () => {
    const routes = [...read("../../nitro.config.ts").matchAll(/route: "([^"]+)"/g)]
      .map((m) => m[1])
      // `/**` is the `.md` → `/raw/**` middleware: it matches every route,
      // including the pages, so it says nothing about ownership.
      .filter((route) => route !== "/**")
      // `/api/docs/page/**:path` → a concrete path under it.
      .map((route) => route.replace(/\/\*\*(?::\w+)?$/, "/sample"));

    // Guard the grep itself: a renamed handler key would otherwise pass by
    // checking nothing at all.
    expect(routes.length).toBeGreaterThanOrEqual(10);
    for (const route of routes) {
      expect(isAppRoute(route), route).toBe(false);
    }
  });

  it("leaves the client's own build assets to the server", () => {
    // Vite's `assetsDir`, i.e. the prefix every built chunk and stylesheet is
    // emitted under. Read from the config so a rename fails here.
    const assetsDir = /assetsDir: "([^"]+)"/.exec(read("../../vite.config.ts"))?.[1];
    expect(assetsDir).toBe("_undocs");
    expect(isAppRoute(`/${assetsDir}/entry-DEADBEEF.js`)).toBe(false);
    expect(isAppRoute(`/${assetsDir}/main-DEADBEEF.css`)).toBe(false);
    // That dir is only the DEFAULT: the Vercel preset's `immutableStaticFiles`
    // repoints the whole bundle at the host's reserved `/_vercel/` namespace
    // (`src/server/vercel.ts`), which is denied as a prefix so the exact dir
    // inside it — salt, framework name — doesn't have to be mirrored here.
    expect(isAppRoute("/_vercel/immutable/undocs/main-DEADBEEF0123456.js")).toBe(false);
    expect(isAppRoute("/_vercel/insights/script.js")).toBe(false);
    // Vite's dev-server namespace.
    expect(isAppRoute("/@vite/client")).toBe(false);
    expect(isAppRoute("/@fs/home/user/undocs/src/app/main.ts")).toBe(false);
  });

  it("leaves public files and the markdown alias to the server", () => {
    for (const path of [
      "/icon.svg",
      "/robots.txt",
      "/sw.js",
      "/unjs.svg",
      // `middleware/raw-redirect.ts` aliases any `.md` path to `/raw/**`.
      "/guide/getting-started.md",
      "/llms.txt",
      "/llms-full.txt",
    ]) {
      expect(isAppRoute(path), path).toBe(false);
    }
  });

  it("rejects anything that is not a rooted path", () => {
    // A relative href has no meaning without the page it sits on, and
    // `//host/path` is a protocol-relative URL rather than a path.
    for (const input of [
      "",
      "#anchor",
      "?q=1",
      "./sibling",
      "../up",
      "guide",
      "//evil.com/guide",
    ]) {
      expect(isAppRoute(input), JSON.stringify(input)).toBe(false);
    }
  });

  it("ignores query and fragment when judging the path", () => {
    expect(isAppRoute("/llms.txt?x=1")).toBe(false);
    expect(isAppRoute("/raw/guide.md#heading")).toBe(false);
    expect(isAppRoute("/guide#llms.txt")).toBe(true);
  });
});
