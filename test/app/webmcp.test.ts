/**
 * WebMCP tools (`src/app/webmcp/*`).
 *
 * The tools talk to the content API over `ofetch`, so the whole suite runs
 * against a stubbed `globalThis.fetch` serving a small in-memory docs set.
 * `ofetch` captures `globalThis.fetch` at module load, hence the `vi.stubGlobal`
 * before any dynamic `import()` of the modules under test.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import MiniSearch from "minisearch";
import { MINISEARCH_OPTIONS, toSearchDocuments } from "@server/content/search-options.ts";
import type { NavItem } from "@server/content/types.ts";
import type { AppRouter } from "@app/router.ts";
import type { ModelContext, ModelContextTool } from "@app/webmcp/types.ts";
// Pure config→URL derivation (no `ofetch`), so a static import is safe here.
import { editUrl, repoLinks, repoUrl, socialLinks } from "@app/webmcp/links.ts";

const ORIGIN = "https://docs.test";

const NAVIGATION: NavItem[] = [
  { title: "Home", path: "/", page: true },
  {
    title: "Guide",
    path: "/guide",
    page: false,
    children: [
      { title: "Getting Started", path: "/guide", page: true, description: "Install and run." },
      // Same path as the section itself — the dedupe case.
      { title: "Getting Started", path: "/guide", page: true },
      { title: "Deploy", path: "/guide/deploy", page: true, description: "Ship it." },
    ],
  },
];

const PAGES: Record<
  string,
  { id: string; title: string; description: string; toc: any[]; markdown: string }
> = {
  // No "/" entry on purpose: like undocs' own docs, this set has no root
  // `index.md` — the landing page is built from config, so `/api/docs/page/
  // _index.json` 404s while `/` is still a real route.
  "/guide": {
    id: "content/2.guide/1.index.md",
    title: "Getting Started",
    description: "Install and run.",
    toc: [
      {
        id: "install",
        depth: 2,
        text: "Install",
        children: [{ id: "npm", depth: 3, text: "npm" }],
      },
    ],
    markdown: "# Getting Started\n\nRun `npm i undocs`.\n",
  },
  "/guide/deploy": {
    id: "content/2.guide/2.deploy.md",
    title: "Deploy",
    description: "Ship it.",
    toc: [{ id: "vercel", depth: 2, text: "Vercel" }],
    markdown: "# Deploy\n\nDeploy to Vercel with zero config.\n",
  },
  // Comfortably past `MARKDOWN_MAX` (40k chars), for the truncate/continue path.
  "/guide/long": {
    id: "content/2.guide/3.long.md",
    title: "Long",
    description: "A very long page.",
    toc: [],
    markdown: `# Long\n\n${"x".repeat(60_000)}\nEND\n`,
  },
};

const SEARCH_SECTIONS = [
  {
    id: "/guide",
    title: "Getting Started",
    titles: [],
    level: 1,
    content: "Install and run undocs.",
  },
  {
    id: "/guide/deploy#vercel",
    title: "Vercel",
    titles: ["Deploy"],
    level: 2,
    content: "Deploy to Vercel with zero config.",
  },
];

/** `/api/docs/page/<slug>.json` → route path (`_index` is the root). */
function pathFromPageSlug(slug: string): string {
  const clean = slug.replace(/\.json$/, "");
  return clean === "_index" ? "/" : `/${clean}`;
}

const fetchStub = vi.fn(async (input: any) => {
  const url = new URL(String(input), ORIGIN);
  const path = url.pathname;

  if (path === "/api/docs/navigation.json") return json(NAVIGATION);

  if (path === "/api/docs/search.json") {
    const ms = new MiniSearch(MINISEARCH_OPTIONS);
    ms.addAll(toSearchDocuments(SEARCH_SECTIONS as any));
    return json(ms.toJSON());
  }

  if (path.startsWith("/api/docs/page/")) {
    const page = PAGES[pathFromPageSlug(path.slice("/api/docs/page/".length))];
    if (!page) return notFound();
    return json({
      path,
      id: page.id,
      title: page.title,
      description: page.description,
      body: { type: "mark", value: [], toc: { links: page.toc } },
    });
  }

  if (path.startsWith("/raw/") && path.endsWith(".md")) {
    const route = path.slice("/raw".length, -".md".length) || "/";
    const page = PAGES[route === "" ? "/" : route];
    if (!page) return notFound();
    return new Response(page.markdown, {
      status: 200,
      headers: { "content-type": "text/markdown" },
    });
  }

  return notFound();
});

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

vi.stubGlobal("fetch", fetchStub);
vi.stubGlobal("location", { origin: ORIGIN });

/** Minimal stand-in for the app router: just the surface the tools touch. */
function createStubRouter(start = "/") {
  const currentRoute = { path: start, hash: "", query: "", fullPath: start, meta: {} };
  const push = vi.fn(async (to: any) => {
    currentRoute.path = typeof to === "string" ? to : to.path;
    currentRoute.hash = (typeof to === "object" && to.hash) || "";
    currentRoute.fullPath = currentRoute.path + currentRoute.hash;
  });
  return { currentRoute, push } as unknown as AppRouter & { push: typeof push };
}

let createDocsTools: typeof import("@app/webmcp/tools/index.ts").createDocsTools;
let setupWebMCP: typeof import("@app/webmcp/index.ts").setupWebMCP;

beforeAll(async () => {
  ({ createDocsTools } = await import("@app/webmcp/tools/index.ts"));
  ({ setupWebMCP } = await import("@app/webmcp/index.ts"));
});

function toolsByName(router: AppRouter = createStubRouter()): Record<string, ModelContextTool> {
  return Object.fromEntries(createDocsTools(router).map((tool) => [tool.name, tool]));
}

describe("webmcp tool descriptors", () => {
  it("exposes the docs tool set", () => {
    expect(Object.keys(toolsByName())).toEqual([
      "search_docs",
      "list_pages",
      "get_project_info",
      "read_page",
      "get_current_page",
      "navigate",
    ]);
  });

  it("satisfies the spec's descriptor constraints", () => {
    for (const tool of createDocsTools(createStubRouter())) {
      // Name: 1-128 chars of alphanumerics plus `_`, `-`, `.`.
      expect(tool.name).toMatch(/^[A-Za-z0-9_.-]{1,128}$/);
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toMatchObject({ type: "object" });
      // Serializable: the UA stringifies the schema for `getTools()`.
      expect(() => JSON.stringify(tool.inputSchema)).not.toThrow();
    }
  });

  it("marks only `navigate` as state-changing", () => {
    const tools = toolsByName();
    const readOnly = [
      "search_docs",
      "list_pages",
      "get_project_info",
      "read_page",
      "get_current_page",
    ];
    for (const name of readOnly) {
      expect(tools[name].annotations?.readOnlyHint).toBe(true);
    }
    expect(tools.navigate.annotations?.readOnlyHint).toBe(false);
  });
});

describe("search_docs", () => {
  it("returns ranked results with linkable urls", async () => {
    const result: any = await toolsByName().search_docs.execute({ query: "vercel" });
    expect(result.count).toBeGreaterThan(0);
    expect(result.results[0]).toMatchObject({
      title: "Vercel",
      path: "/guide/deploy",
      url: `${ORIGIN}/guide/deploy#vercel`,
      breadcrumb: "Deploy",
    });
  });

  it("honours `limit` and rejects an empty query", async () => {
    const { search_docs } = toolsByName();
    const result: any = await search_docs.execute({ query: "undocs deploy install", limit: 1 });
    expect(result.results).toHaveLength(1);
    await expect(search_docs.execute({ query: "  " })).rejects.toThrow(/required/);
  });
});

describe("list_pages", () => {
  it("flattens the navigation tree and dedupes section index pages", async () => {
    const result: any = await toolsByName().list_pages.execute({});
    expect(result.pages.map((p: any) => p.path)).toEqual(["/", "/guide", "/guide/deploy"]);
    expect(result.count).toBe(3);
    expect(result.site.name).toBe("Test Docs");
  });
});

describe("get_project_info", () => {
  it("derives the repository, community and llms.txt links from the docs config", async () => {
    const result: any = await toolsByName().get_project_info.execute({});
    expect(result.repository).toEqual({
      url: "https://github.com/unjs/undocs",
      issues: "https://github.com/unjs/undocs/issues",
      releases: "https://github.com/unjs/undocs/releases",
      branch: "main",
    });
    // Bare handles expand via the key; explicit URLs pass through.
    expect(result.links).toEqual([
      { label: "X", url: "https://x.com/unjsio" },
      { label: "Discord", url: "https://discord.gg/example" },
    ]);
    expect(result.llms).toEqual({
      index: `${ORIGIN}/llms.txt`,
      full: `${ORIGIN}/llms-full.txt`,
    });
    // `to` is normalized to an absolute `url`, like every other tool result.
    expect(result.versions).toEqual([{ label: "v3", url: "https://docs.test", active: true }]);
    expect(result.site.name).toBe("Test Docs");
  });
});

describe("read_page", () => {
  it("returns the source markdown", async () => {
    const result: any = await toolsByName().read_page.execute({ path: "/guide/deploy" });
    expect(result.markdown).toContain("Deploy to Vercel");
    expect(result.truncated).toBe(false);
    expect(result.url).toBe(`${ORIGIN}/guide/deploy`);
  });

  it("carries the markdown and edit links for the page", async () => {
    const result: any = await toolsByName().read_page.execute({ path: "/guide/deploy" });
    expect(result.markdownUrl).toBe(`${ORIGIN}/raw/guide/deploy.md`);
    expect(result.editUrl).toBe(
      "https://github.com/unjs/undocs/edit/main/docs/2.guide/2.deploy.md",
    );
  });

  it("normalizes what an agent passes as `path`", async () => {
    const { read_page } = toolsByName();
    for (const input of [
      "/guide/deploy/",
      "guide/deploy",
      "/guide/deploy.md",
      `${ORIGIN}/guide/deploy#vercel`,
    ]) {
      const result: any = await read_page.execute({ path: input });
      expect(result.path, input).toBe("/guide/deploy");
    }
  });

  it("errors on an unknown page", async () => {
    await expect(toolsByName().read_page.execute({ path: "/nope" })).rejects.toThrow(
      /No documentation page/,
    );
  });

  it("explains that a generated route has no source, rather than 404-ing at it", async () => {
    // `/` and `/blog` are real routes an agent sees in results, but they have no
    // markdown behind them — "not found" would read as a broken link.
    for (const path of ["/", "/blog"]) {
      await expect(toolsByName().read_page.execute({ path })).rejects.toThrow(
        /generated, not written in Markdown/,
      );
    }
  });

  it("hands back a long page in slices with a continuation cursor", async () => {
    const { read_page } = toolsByName();
    const first: any = await read_page.execute({ path: "/guide/long" });
    expect(first.truncated).toBe(true);
    expect(first.offset).toBe(0);
    expect(first.markdown).toHaveLength(40_000);
    expect(first.nextOffset).toBe(40_000);

    const second: any = await read_page.execute({ path: "/guide/long", offset: first.nextOffset });
    expect(second.offset).toBe(40_000);
    expect(second.truncated).toBe(false);
    expect(second.nextOffset).toBeUndefined();
    expect(second.markdown).toContain("END");
    // The two slices reassemble the whole source, with nothing dropped.
    expect(first.markdown.length + second.markdown.length).toBe(first.length);
  });

  it("clamps a nonsense offset instead of returning junk", async () => {
    const { read_page } = toolsByName();
    const negative: any = await read_page.execute({ path: "/guide/deploy", offset: -5 });
    expect(negative.offset).toBe(0);
    expect(negative.markdown).toContain("Deploy to Vercel");

    const past: any = await read_page.execute({ path: "/guide/deploy", offset: 10_000 });
    expect(past.offset).toBe(past.length);
    expect(past.markdown).toBe("");
    expect(past.truncated).toBe(false);
  });
});

describe("get_current_page", () => {
  it("reports the route the visitor is on, with its heading outline", async () => {
    const router = createStubRouter("/guide");
    const result: any = await toolsByName(router).get_current_page.execute({});
    expect(result).toMatchObject({ path: "/guide", title: "Getting Started" });
    expect(result.headings).toEqual([
      { text: "Install", hash: "#install", depth: 2 },
      { text: "npm", hash: "#npm", depth: 3 },
    ]);
  });

  it("falls back to the site description on a route with no content page", async () => {
    const router = createStubRouter("/");
    const result: any = await toolsByName(router).get_current_page.execute({});
    expect(result).toMatchObject({
      path: "/",
      description: "Documentation used by the undocs test-suite.",
      headings: [],
    });
    // No content-index entry → no `/raw` source and no edit link to offer.
    expect(result.markdownUrl).toBeUndefined();
    expect(result.editUrl).toBeUndefined();
  });
});

describe("navigate", () => {
  it("pushes the route and reports where it landed", async () => {
    const router = createStubRouter("/");
    const result: any = await toolsByName(router).navigate.execute({
      path: "/guide/deploy",
      hash: "vercel",
    });
    expect((router as any).push).toHaveBeenCalledWith({ path: "/guide/deploy", hash: "#vercel" });
    expect(result).toMatchObject({ navigated: true, path: "/guide/deploy", title: "Deploy" });
  });

  it("allows the routes that have no content-index page", async () => {
    // The landing page is built from `landing` config and the blog listing is
    // generated — neither is in the content index, both are real routes.
    for (const path of ["/", "/blog"]) {
      const router = createStubRouter("/guide");
      await expect(toolsByName(router).navigate.execute({ path })).resolves.toMatchObject({
        navigated: true,
        path,
      });
    }
  });

  it("refuses an unknown page instead of stranding the visitor on a 404", async () => {
    const router = createStubRouter("/");
    await expect(toolsByName(router).navigate.execute({ path: "/nope" })).rejects.toThrow(
      /No documentation page/,
    );
    expect((router as any).push).not.toHaveBeenCalled();
  });

  it("allows a user-defined `.docs/pages/**` route", async () => {
    // Custom pages are real routes with no content-index entry either — they
    // are matched off the same route table `router.ts` builds.
    const router = createStubRouter("/");
    await expect(
      toolsByName(router).navigate.execute({ path: "/showcase" }),
    ).resolves.toMatchObject({ navigated: true, path: "/showcase" });
  });

  it("does not poison the docs page cache when an agent mistypes a path", async () => {
    // `pages/[...slug].vue` keys its `useAsyncData` by `kebabCase(path)`, which
    // collapses `/guide-deploy` and `/guide/deploy` onto ONE entry — and a 404
    // resolves to `null` rather than throwing. Probing an agent's typo through
    // that key would cache `null` under the real page, and the visitor's next
    // navigation there would throw a fatal 404 on a page that exists.
    const { useAsyncData } = await import("@app/composables/useAsyncData.ts");
    const { queryPage } = await import("@app/composables/useContent.ts");
    const { kebabCase } = await import("scule");

    const router = createStubRouter("/");
    for (const typo of ["/guide-deploy", "/Guide/Deploy"]) {
      await expect(toolsByName(router).navigate.execute({ path: typo })).rejects.toThrow(
        /No documentation page/,
      );
    }

    const entry = await useAsyncData(kebabCase("/guide/deploy"), () => queryPage("/guide/deploy"));
    expect(entry.data.value).toMatchObject({ title: "Deploy" });
  });
});

describe("setupWebMCP", () => {
  function createFakeModelContext(fail?: string) {
    const registered: Array<{ tool: ModelContextTool; signal?: AbortSignal }> = [];
    const modelContext = {
      registerTool: vi.fn(async (tool: ModelContextTool, options?: { signal?: AbortSignal }) => {
        if (tool.name === fail) throw new DOMException("nope", "NotAllowedError");
        registered.push({ tool, signal: options?.signal });
      }),
    } as unknown as ModelContext;
    return { modelContext, registered };
  }

  it("registers every tool against an abort signal and tears them down", async () => {
    const { modelContext, registered } = createFakeModelContext();
    vi.stubGlobal("document", { modelContext });

    const teardown = await setupWebMCP(createStubRouter());
    expect(registered).toHaveLength(6);
    expect(registered.every((r) => r.signal instanceof AbortSignal)).toBe(true);
    expect(registered.every((r) => !r.signal!.aborted)).toBe(true);

    teardown();
    expect(registered.every((r) => r.signal!.aborted)).toBe(true);
  });

  it("survives a rejected registration and aborts the previous set on re-setup", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const first = createFakeModelContext("navigate");
    vi.stubGlobal("document", { modelContext: first.modelContext });

    await setupWebMCP(createStubRouter());
    expect(first.registered).toHaveLength(5); // `navigate` rejected, the rest survived
    expect(warn).toHaveBeenCalled();

    const second = createFakeModelContext();
    vi.stubGlobal("document", { modelContext: second.modelContext });
    await setupWebMCP(createStubRouter());

    expect(second.registered).toHaveLength(6);
    // The first batch's signal is retired, so its tools are unregistered.
    expect(first.registered.every((r) => r.signal!.aborted)).toBe(true);
    warn.mockRestore();
  });

  it("is a no-op without `document.modelContext`", async () => {
    vi.stubGlobal("document", {});
    await expect(setupWebMCP(createStubRouter())).resolves.toBeTypeOf("function");
  });
});

describe("project links", () => {
  it("accepts both `owner/repo` and a full repository URL", () => {
    expect(repoUrl("unjs/undocs")).toBe("https://github.com/unjs/undocs");
    expect(repoUrl("https://github.com/unjs/undocs/")).toBe("https://github.com/unjs/undocs");
    expect(repoUrl(undefined)).toBeUndefined();
    expect(repoUrl("")).toBeUndefined();
  });

  it("synthesizes `issues`/`releases` only for a GitHub repo", () => {
    expect(repoLinks("unjs/undocs", "dev")).toEqual({
      url: "https://github.com/unjs/undocs",
      issues: "https://github.com/unjs/undocs/issues",
      releases: "https://github.com/unjs/undocs/releases",
      branch: "dev",
    });
    // Another forge has its own URL shape (GitLab nests both under `/-/`), so
    // the repo URL is all we can honestly claim.
    expect(repoLinks("https://gitlab.com/unjs/undocs", undefined)).toEqual({
      url: "https://gitlab.com/unjs/undocs",
      issues: undefined,
      releases: undefined,
      branch: "main",
    });
    expect(repoLinks(undefined, "main")).toBeUndefined();
  });

  it("expands social handles by platform key and passes URLs through", () => {
    expect(
      socialLinks({
        x: "unjsio",
        bluesky: "https://bsky.app/profile/unjs.io",
        nitro: { label: "Nitro", to: "https://nitro.build" },
        empty: "",
        broken: { label: "No URL" },
        discord: "#", // placeholder, as in undocs' own config
      }),
    ).toEqual([
      { label: "X", url: "https://x.com/unjsio" },
      { label: "Bluesky", url: "https://bsky.app/profile/unjs.io" },
      { label: "Nitro", url: "https://nitro.build" },
    ]);
  });

  it("builds the edit url from the page's content id, defaulting the branch", () => {
    expect(editUrl("unjs/undocs", undefined, "content/1.guide/1.index.md")).toBe(
      "https://github.com/unjs/undocs/edit/main/docs/1.guide/1.index.md",
    );
    expect(editUrl("unjs/undocs", "dev", "content/1.guide/1.index.md")).toBe(
      "https://github.com/unjs/undocs/edit/dev/docs/1.guide/1.index.md",
    );
    // No repo configured, or a route with no content page → no edit link.
    expect(editUrl(undefined, "main", "content/x.md")).toBeUndefined();
    expect(editUrl("unjs/undocs", "main", undefined)).toBeUndefined();
  });
});
