import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useRuntimeConfig } from "nitro/runtime-config";
import MiniSearch from "minisearch";
import type { AsPlainObject } from "minisearch";
import { invalidateIndex } from "../src/server/content/store";
import {
  MINISEARCH_OPTIONS,
  MINISEARCH_SEARCH_OPTIONS,
} from "../src/server/content/search-options";

// og.get pulls its fonts + fallback icon from Nitro asset storage
// (`useStorage("assets/og-*")`), which only exists in a built server. Back those
// bases with the real on-disk asset dirs so the route can render a genuine PNG:
//   assets/og-image → src/server/og-assets  (bundled fonts + unjs.svg)
//   assets/og-public → src/app/public       (icon.svg)
//   assets/og-docs   → (absent — the docs override dir; falls through)
// The factory is hoisted above imports, so it may not close over module-scope
// vars: it resolves dirs from process.cwd() and imports node:fs lazily at call time.
vi.mock("nitro/storage", () => {
  const dirs: Record<string, string> = {
    "assets/og-image": "src/server/og-assets",
    "assets/og-public": "src/app/public",
  };
  const read = async (base: string, key: string, raw: boolean) => {
    const dir = dirs[base];
    if (!dir) return null;
    const { readFile } = await import("node:fs/promises");
    const { join: joinPath } = await import("node:path");
    try {
      return await readFile(joinPath(process.cwd(), dir, key), raw ? undefined : "utf8");
    } catch {
      return null;
    }
  };
  return {
    useStorage: (base: string) => ({
      getItem: (key: string) => read(base, key, false),
      getItemRaw: (key: string) => read(base, key, true),
    }),
  };
});

// Every route is an h3 handler exported as the module default. h3 handlers carry
// a `.fetch(Request)` method, so we can exercise a route end to end without a
// running Nitro server: point `useRuntimeConfig()` at an on-disk docs fixture,
// import the route's default export, and call `.fetch`.
//
// The content routes read the shared index from `store.getIndex()`, which is
// built lazily on first request from `runtimeConfig.undocs.dir`. Vitest isolates
// each test file's module graph, so the store cache here is private to this file.
//
// Not covered (cannot be *fully* unit tested this way):
//   - raw.get:  its happy path reads a `slug` router param that only a matched
//               route populates; `.fetch` alone leaves it undefined, so only the
//               guard (404) is reachable here.
//   - contributors/sponsors happy paths: proxy live upstreams over the network;
//               only the deterministic "not configured" branch is tested.

let dir: string;

// Route handler default exports, each with a `.fetch(Request) => Promise<Response>`.
// The routes dir mirrors the registered URL paths (see `nitro.config.ts` handlers),
// so map each logical name to a static import of its file under `src/server/routes/`.
// (Static import expressions — not a computed template — so Vite can analyze the
// nested paths; its dynamic-import helper only resolves one level deep.)
type Handler = { fetch: (req: Request) => Promise<Response> };
// Route defaults are nitro `defineHandler` results whose `.fetch` resolves to a
// `TypedResponse` — structurally a `Response`, but its narrowed `headers` type
// isn't assignable to `Response` under `strictFunctionTypes`. Type the map loosely
// and re-assert `Handler` in `load`; at runtime these are plain `Response`s.
const ROUTES: Record<string, () => Promise<{ default: unknown }>> = {
  navigation: () => import("../src/server/routes/api/docs/navigation.get.ts"),
  search: () => import("../src/server/routes/api/docs/search.get.ts"),
  page: () => import("../src/server/routes/api/docs/page/[...path].get.ts"),
  sponsors: () => import("../src/server/routes/api/docs/sponsors.get.ts"),
  contributors: () => import("../src/server/routes/api/docs/contributors.get.ts"),
  content: () => import("../src/server/routes/api/_content.get.ts"),
  raw: () => import("../src/server/routes/raw/[...slug].get.ts"),
  llms: () => import("../src/server/routes/llms.txt.get.ts"),
  "llms-full": () => import("../src/server/routes/llms-full.txt.get.ts"),
  og: () => import("../src/server/routes/_og/[...slug].get.ts"),
};
const load = async (name: string): Promise<Handler> => (await ROUTES[name]()).default as Handler;

const req = (path: string) => new Request(`http://localhost${path}`);

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "undocs-api-"));

  // A tiny three-page fixture: "/", "/guide", "/guide/usage".
  await writeFile(
    join(dir, "index.md"),
    "---\ntitle: Home\n---\n\n# Home\n\n> Welcome home\n\nIntro text.\n",
  );
  await mkdir(join(dir, "1.guide"), { recursive: true });
  await writeFile(
    join(dir, "1.guide", "1.index.md"),
    "# Guide\n\n> The guide\n\nOverview.\n\n## Setup\n\nInstall it.\n\n```ts\nconst a = 1\n```\n",
  );
  await writeFile(join(dir, "1.guide", "2.usage.md"), "# Usage\n\n> Using it\n\nHow to use.\n");

  // Seed the runtime config the routes read. Deliberately omit `github` and
  // `sponsorsAPI` so the proxy routes hit their "not configured" branch.
  (useRuntimeConfig as unknown as { _cached?: unknown })._cached = {
    app: {},
    nitro: {},
    undocs: {
      dir,
      url: "https://example.dev",
      name: "Example",
      title: "Example Docs",
      description: "Example description",
      themeColor: "amber",
      llmsFull: { title: "Example Full", description: "Full description" },
    },
  };

  invalidateIndex();
}, 60_000);

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe("/api/docs/navigation", () => {
  it("returns the navigation tree", async () => {
    const res = await (await load("navigation")).fetch(req("/"));
    expect(res.status).toBe(200);
    const nav = (await res.json()) as Array<{ path: string; children?: unknown[] }>;
    const guide = nav.find((n) => n.path === "/guide");
    expect(guide).toBeDefined();
    expect(guide!.children?.length).toBeGreaterThan(0);
  });
});

describe("/api/docs/search", () => {
  it("returns a serialized MiniSearch index that finds per-heading entries", async () => {
    const res = await (await load("search")).fetch(req("/"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as AsPlainObject;
    // Rehydrate with the same shared options the client uses and query it.
    const ms = MiniSearch.loadJS(data, MINISEARCH_OPTIONS);
    expect(ms.documentCount).toBeGreaterThan(3);
    const hits = ms.search("setup", MINISEARCH_SEARCH_OPTIONS);
    expect(hits.some((h) => h.id === "/guide#setup")).toBe(true);
  });
});

describe("/api/docs/page/[...path]", () => {
  it("returns a page by path slug", async () => {
    const res = await (await load("page")).fetch(req("/api/docs/page/guide.json"));
    expect(res.status).toBe(200);
    const page = (await res.json()) as { title: string; path: string };
    expect(page.title).toBe("Guide");
    expect(page.path).toBe("/guide");
  });

  it("maps the `_index` slug to the root page", async () => {
    const res = await (await load("page")).fetch(req("/api/docs/page/_index.json"));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { title: string }).title).toBe("Home");
  });

  it("tolerates a trailing slash", async () => {
    const res = await (await load("page")).fetch(req("/api/docs/page/guide/.json"));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { path: string }).path).toBe("/guide");
  });

  it("404s for an unknown path", async () => {
    const res = await (await load("page")).fetch(req("/api/docs/page/missing.json"));
    expect(res.status).toBe(404);
  });

  // Source order zero-pads numeric prefixes, so numbered dirs (`1.guide/*`) sort
  // ahead of the un-numbered root `index.md`: order is ["/guide", "/guide/usage", "/"].
  it("embeds [prev, next] surround for a middle page", async () => {
    const res = await (await load("page")).fetch(req("/api/docs/page/guide/usage.json"));
    const { surround } = (await res.json()) as {
      surround: Array<{ path: string } | null>;
    };
    expect(surround[0]?.path).toBe("/guide");
    expect(surround[1]?.path).toBe("/");
  });

  it("embeds a null previous for the first page", async () => {
    const res = await (await load("page")).fetch(req("/api/docs/page/guide.json"));
    const { surround } = (await res.json()) as {
      surround: Array<{ path: string } | null>;
    };
    expect(surround[0]).toBeNull();
    expect(surround[1]?.path).toBe("/guide/usage");
  });
});

describe("/llms.txt", () => {
  it("returns a plain-text index linking every page", async () => {
    const res = await (await load("llms")).fetch(req("/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const text = await res.text();
    expect(text).toContain("# Example Docs");
    expect(text).toContain("> Example description");
    expect(text).toContain("## Docs");
    expect(text).toContain("https://example.dev/raw/guide.md");
  });
});

describe("/llms-full.txt", () => {
  it("returns the concatenated markdown of every page", async () => {
    const res = await (await load("llms-full")).fetch(req("/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const text = await res.text();
    expect(text).toContain("# Example Full");
    expect(text).toContain("> Full description");
    expect(text).toContain("# Home");
    expect(text).toContain("# Usage");
  });
});

describe("/api/_content", () => {
  it("renders the build-stats debug page", async () => {
    const res = await (await load("content")).fetch(req("/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("Content build stats");
    expect(html).toContain("Phases");
    expect(html).toContain("Counts");
    expect(html).toContain(dir);
  });

  it("forces a cold rebuild with ?fresh", async () => {
    const res = await (await load("content")).fetch(req("/?fresh"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("cold rebuild");
  });
});

describe("/raw/**:slug", () => {
  it("404s when the slug is missing / not a .md path", async () => {
    // `.fetch` alone can't populate the `slug` router param, so only the guard
    // is reachable — its happy path is covered by an integration test elsewhere.
    const res = await (await load("raw")).fetch(req("/"));
    expect(res.status).toBe(404);
  });
});

describe("/api/docs/contributors", () => {
  it("404s when docs.github is not configured", async () => {
    const res = await (await load("contributors")).fetch(req("/"));
    expect(res.status).toBe(404);
  });
});

describe("/api/docs/sponsors", () => {
  it("404s when docs.sponsors.api is not configured", async () => {
    const res = await (await load("sponsors")).fetch(req("/"));
    expect(res.status).toBe(404);
  });
});

// og.get renders a PNG via takumi from bundled fonts + the icon svg. Those live
// in Nitro asset storage (`useStorage("assets/og-*")`), mocked above to read the
// real on-disk asset dirs, so the route renders an actual image here.
describe("/_og/**", () => {
  it("renders a PNG og image, loading meta from the content path", async () => {
    const res = await (await load("og")).fetch(req("/_og/guide.png"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(0);
    // PNG magic number: 89 50 4E 47.
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("renders the landing card for `_index`", async () => {
    const res = await (await load("og")).fetch(req("/_og/_index.png"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  it("404s for an unknown content path", async () => {
    const res = await (await load("og")).fetch(req("/_og/nope.png"));
    expect(res.status).toBe(404);
  });

  it("404s when the path is not a .png", async () => {
    const res = await (await load("og")).fetch(req("/_og/guide"));
    expect(res.status).toBe(404);
  });
});
