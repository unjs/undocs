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
// Same deal for the polyfill: types only, and nothing runs until it is called.
import { installWebMCPPolyfill } from "@app/webmcp/polyfill.ts";
import { isExternalRedirect, normalizeRedirects, resolveRedirect } from "@app/utils/redirects.ts";
import appConfig from "../stubs/app-config.ts";

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
  // A pair that BOTH exist and collide under `kebabCase` (`-guide-nested`), for
  // the cache-key test below. Untouched by every other test, so that one owns
  // the shared `useAsyncData` entry and cannot be raced by test order.
  "/guide/nested": {
    id: "content/2.guide/4.nested/1.index.md",
    title: "Nested",
    description: "The real nested page.",
    toc: [],
    markdown: "# Nested\n\nThe real nested page.\n",
  },
  "/guide-nested": {
    id: "content/2.guide-nested.md",
    title: "Guide Nested",
    description: "A sibling that kebab-cases onto the same key.",
    toc: [],
    markdown: "# Guide Nested\n\nA sibling page.\n",
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

/** The docs-config redirects the stub app config declares, normalized once. */
const REDIRECTS = normalizeRedirects(appConfig.docs.redirects);

/**
 * Minimal stand-in for the app router: just the surface the tools touch.
 *
 * It resolves configured redirects before committing a path, because the real
 * `router.ts` does — the tools hand it the path the AGENT asked for and leave
 * executing the redirect to it, so a stub that skipped that step would report a
 * landing page no visitor ever sees. An off-site target leaves the app
 * (`window.location.replace`), so the route stays put here too.
 */
function createStubRouter(start = "/") {
  const currentRoute = { path: start, hash: "", query: "", fullPath: start, meta: {} };
  const push = vi.fn(async (to: any) => {
    const asked = typeof to === "string" ? to : to.path;
    const target = resolveRedirect(REDIRECTS, asked);
    if (target !== undefined && isExternalRedirect(target)) return;
    currentRoute.path = target ?? asked;
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

/**
 * Unwrap an MCP-shaped result into its text block and its metadata.
 *
 * The prose-carrying tools answer with `{ content: [{ type: "text", text }],
 * structuredContent }` so a client that speaks MCP renders the text as text
 * rather than as a JSON-escaped string. Asserting the envelope here means every
 * call site below reads the same as it did against the old flat object.
 */
function unwrap(result: any): { text: string; data: any } {
  expect(result.content).toEqual([{ type: "text", text: expect.any(String) }]);
  return { text: result.content[0].text, data: result.structuredContent };
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

  // Docs pages, nav and config all come out of the one repo the site is built
  // from, so every result is the page author's own content (see `types.ts`).
  // Flagging one tool is a claim it reaches something the others don't; this
  // keeps that a decision instead of a copy-paste.
  it("treats every docs tool's content as trusted", () => {
    for (const tool of createDocsTools(createStubRouter())) {
      expect(tool.annotations?.untrustedContentHint).toBeUndefined();
    }
  });

  // The MCP envelope buys a tool one thing: prose that reaches the client model
  // as text instead of as a JSON-escaped string. The metadata-only tools have no
  // prose to unescape, so wrapping them would only cost a nesting level — which
  // makes "which tools are wrapped" a decision worth pinning.
  it("wraps only the prose-carrying tools in the MCP content shape", async () => {
    const router = createStubRouter("/guide");
    const tools = toolsByName(router);
    const wrapped: any[] = await Promise.all([
      tools.search_docs!.execute({ query: "vercel" }),
      tools.read_page!.execute({ path: "/guide/deploy" }),
    ]);
    for (const result of wrapped) {
      expect(result.content).toEqual([{ type: "text", text: expect.any(String) }]);
      expect(result.structuredContent).toBeTypeOf("object");
    }

    const plain: any[] = await Promise.all([
      tools.list_pages!.execute({}),
      tools.get_project_info!.execute({}),
      tools.get_current_page!.execute({}),
      tools.navigate!.execute({ path: "/guide/deploy" }),
    ]);
    for (const result of plain) {
      expect(result.content).toBeUndefined();
      expect(result.structuredContent).toBeUndefined();
    }
  });
});

describe("search_docs", () => {
  // A hit addresses itself the way the other tools take input: `path` is
  // `read_page`'s argument and `hash` is `navigate`'s. An absolute URL here
  // would make the agent strip an origin back off before it could act.
  it("addresses hits by route path and anchor, never an absolute url", async () => {
    const { data } = unwrap(await toolsByName().search_docs.execute({ query: "vercel" }));
    expect(data.count).toBeGreaterThan(0);
    expect(data.results[0]).toMatchObject({
      title: "Vercel",
      path: "/guide/deploy",
      hash: "#vercel",
      breadcrumb: "Deploy",
    });
    expect(JSON.stringify(data)).not.toContain(ORIGIN);
  });

  it("omits the anchor on a page-level hit", async () => {
    const { data } = unwrap(await toolsByName().search_docs.execute({ query: "install" }));
    expect(data.results[0]).toMatchObject({ path: "/guide", title: "Getting Started" });
    expect(data.results[0].hash).toBeUndefined();
  });

  it("renders the previews as prose in the result's text block", async () => {
    // The previews are the prose half of a search result; escaped into a JSON
    // string they reach the client model as `\n`-littered source. The text
    // block carries them readably, breadcrumb and relative link included.
    const { text } = unwrap(await toolsByName().search_docs.execute({ query: "vercel" }));
    expect(text).toContain("1. Deploy > Vercel\n   /guide/deploy#vercel");
    expect(text).toContain("Deploy to Vercel with zero config.");
  });

  it("says so in the text block when nothing matched", async () => {
    const result: any = await toolsByName().search_docs.execute({ query: "zzqqxx" });
    const { text, data } = unwrap(result);
    expect(data).toMatchObject({ count: 0, results: [] });
    expect(text).toBe('No results for "zzqqxx".');
  });

  it("honours `limit` and rejects an empty query", async () => {
    const { search_docs } = toolsByName();
    const { data } = unwrap(
      await search_docs.execute({ query: "undocs deploy install", limit: 1 }),
    );
    expect(data.results).toHaveLength(1);
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
  it("returns the source markdown as the result's text block", async () => {
    // A whole page of Markdown in a JSON field reaches the client model with a
    // literal `\n` for every newline; MCP's `content` shape is what avoids it.
    const result: any = await toolsByName().read_page.execute({ path: "/guide/deploy" });
    const { text, data } = unwrap(result);
    expect(text).toBe(PAGES["/guide/deploy"]!.markdown);
    expect(data.truncated).toBe(false);
    expect(data.url).toBe(`${ORIGIN}/guide/deploy`);
    // Never duplicated into the structured half — that would double the payload
    // for exactly the client that cannot unwrap the text block.
    expect(JSON.stringify(data)).not.toContain("Deploy to Vercel");
  });

  it("carries the markdown and edit links for the page", async () => {
    const { data } = unwrap(await toolsByName().read_page.execute({ path: "/guide/deploy" }));
    expect(data.markdownUrl).toBe(`${ORIGIN}/raw/guide/deploy.md`);
    expect(data.editUrl).toBe("https://github.com/unjs/undocs/edit/main/docs/2.guide/2.deploy.md");
  });

  it("normalizes what an agent passes as `path`", async () => {
    const { read_page } = toolsByName();
    for (const input of [
      "/guide/deploy/",
      "guide/deploy",
      "/guide/deploy.md",
      `${ORIGIN}/guide/deploy#vercel`,
    ]) {
      const { data } = unwrap(await read_page.execute({ path: input }));
      expect(data.path, input).toBe("/guide/deploy");
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
    const first = unwrap(await read_page.execute({ path: "/guide/long" }));
    expect(first.data.truncated).toBe(true);
    expect(first.data.offset).toBe(0);
    expect(first.text).toHaveLength(40_000);
    expect(first.data.nextOffset).toBe(40_000);

    const second = unwrap(
      await read_page.execute({ path: "/guide/long", offset: first.data.nextOffset }),
    );
    expect(second.data.offset).toBe(40_000);
    expect(second.data.truncated).toBe(false);
    expect(second.data.nextOffset).toBeUndefined();
    expect(second.text).toContain("END");
    // The two slices reassemble the whole source, with nothing dropped.
    expect(first.text.length + second.text.length).toBe(first.data.length);
  });

  it("takes a page in smaller slices when a caller asks for less", async () => {
    // A model with a small context window can't take 40k characters in one go;
    // `maxLength` lets it walk the same `nextOffset` cursor in its own steps.
    const { read_page } = toolsByName();
    const first = unwrap(await read_page.execute({ path: "/guide/long", maxLength: 100 }));
    expect(first.text).toHaveLength(100);
    expect(first.data).toMatchObject({ offset: 0, truncated: true, nextOffset: 100 });

    const second = unwrap(
      await read_page.execute({ path: "/guide/long", offset: 100, maxLength: 100 }),
    );
    expect(second.text).toHaveLength(100);
    expect(second.data.offset).toBe(100);
    // Contiguous with the first slice, not a re-read of it.
    expect(first.text + second.text).toBe(PAGES["/guide/long"]!.markdown.slice(0, 200));
  });

  it("clamps `maxLength` to the cap rather than refusing the call", async () => {
    const { read_page } = toolsByName();
    for (const maxLength of [10_000_000, 0, -1, "lots", undefined]) {
      const { text } = unwrap(await read_page.execute({ path: "/guide/long", maxLength }));
      expect(text, String(maxLength)).toHaveLength(40_000);
    }
  });

  it("clamps a nonsense offset instead of returning junk", async () => {
    const { read_page } = toolsByName();
    const negative = unwrap(await read_page.execute({ path: "/guide/deploy", offset: -5 }));
    expect(negative.data.offset).toBe(0);
    expect(negative.text).toContain("Deploy to Vercel");

    const past = unwrap(await read_page.execute({ path: "/guide/deploy", offset: 10_000 }));
    expect(past.data.offset).toBe(past.data.length);
    expect(past.text).toBe("");
    expect(past.data.truncated).toBe(false);
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

  it("does not poison the docs page cache when an agent reads a colliding REAL page", async () => {
    // Proving the path real is not enough to earn the docs page's key: two
    // paths that both exist collide under `kebabCase` just the same
    // (`/guide-nested` and `/guide/nested` → `-guide-nested`), so reading one
    // through that key would serve the OTHER page's title/description/outline
    // on the visitor's next navigation there.
    const { useAsyncData } = await import("@app/composables/useAsyncData.ts");
    const { queryPage } = await import("@app/composables/useContent.ts");
    const { kebabCase } = await import("scule");

    const { data } = unwrap(await toolsByName().read_page.execute({ path: "/guide-nested" }));
    expect(data).toMatchObject({ title: "Guide Nested" });

    const entry = await useAsyncData(kebabCase("/guide/nested"), () => queryPage("/guide/nested"));
    expect(entry.data.value).toMatchObject({ title: "Nested" });
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

describe("webmcp polyfill", () => {
  /** A fresh document + window per test, so the tool registry starts empty. */
  function stubBrowser(document: any = {}) {
    vi.stubGlobal("document", document);
    vi.stubGlobal("window", { origin: ORIGIN });
    return document;
  }

  /** The real lazy loader: registers the docs tools into whatever is installed. */
  function toolLoader(router: AppRouter = createStubRouter()) {
    return vi.fn(() => setupWebMCP(router));
  }

  it("installs `document.modelContext` only when the browser has none", () => {
    const document = stubBrowser();
    const modelContext = installWebMCPPolyfill(toolLoader());
    expect(document.modelContext).toBe(modelContext);

    // A native implementation wins, and a second install does not replace ours.
    const native = { registerTool: vi.fn() } as unknown as ModelContext;
    stubBrowser({ modelContext: native });
    expect(installWebMCPPolyfill(toolLoader())).toBe(native);
  });

  it("defers the tools chunk until an agent looks for tools", async () => {
    stubBrowser();
    const load = toolLoader();
    const modelContext = installWebMCPPolyfill(load)!;
    expect(load).not.toHaveBeenCalled();
    expect(window.__webmcp_registered_tools?.size ?? 0).toBe(0);

    const tools = await modelContext.getTools();
    expect(load).toHaveBeenCalledTimes(1);
    expect(tools.map((t) => t.name)).toEqual([
      "search_docs",
      "list_pages",
      "get_project_info",
      "read_page",
      "get_current_page",
      "navigate",
    ]);

    // Loaded once, not once per lookup.
    await modelContext.getTools();
    expect(load).toHaveBeenCalledTimes(1);
  });

  // An agent that subscribes and then reads the registry directly never calls
  // `getTools()` — the one blind spot of loading the tools lazily.
  it("loads the tools for an agent that only subscribes to `toolchange`", async () => {
    stubBrowser();
    const load = toolLoader();
    const modelContext = installWebMCPPolyfill(load)!;

    const changed = vi.fn();
    modelContext.ontoolchange = changed;
    expect(load).toHaveBeenCalledTimes(1);
    await load.mock.results[0]!.value;

    expect(changed).toHaveBeenCalledTimes(6); // one event per registration
    expect([...window.__webmcp_registered_tools!.keys()]).toContain("search_docs");
  });

  it("hands out the reference polyfill's tool shape", async () => {
    stubBrowser();
    const modelContext = installWebMCPPolyfill(toolLoader())!;
    const [search] = await modelContext.getTools();

    expect(search).toMatchObject({
      name: "search_docs",
      description: expect.any(String),
      origin: ORIGIN,
      window: globalThis.window,
      annotations: { readOnlyHint: true },
    });
    // Stringified, because that is what `JSON.parse(tool.inputSchema)` in every
    // polyfill consumer expects (the spec's own field is the object).
    expect(search!.inputSchema).toBeTypeOf("string");
    expect(JSON.parse(search!.inputSchema as string)).toMatchObject({ type: "object" });
  });

  it("executes a tool by descriptor, by name and from JSON arguments", async () => {
    stubBrowser();
    const modelContext = installWebMCPPolyfill(toolLoader())!;
    const tools = await modelContext.getTools();
    const search = tools.find((t) => t.name === "search_docs")!;

    const { data } = unwrap(await modelContext.executeTool!(search, { query: "vercel" }));
    expect(data.results[0]).toMatchObject({ path: "/guide/deploy" });

    const byName: any = await modelContext.executeTool!("search_docs", '{"query":"vercel"}');
    expect(unwrap(byName).data.count).toBe(data.count);

    await expect(modelContext.executeTool!("no_such_tool", {})).rejects.toThrow(/not found/);
  });

  it("rejects a duplicate name and unregisters on abort", async () => {
    stubBrowser();
    const modelContext = installWebMCPPolyfill(toolLoader())!;
    await modelContext.getTools();

    const duplicate = modelContext.registerTool({
      name: "search_docs",
      description: "A second one.",
      execute: () => null,
    });
    await expect(duplicate).rejects.toMatchObject({ name: "InvalidStateError" });

    // `setupWebMCP`'s teardown retires the whole set — the spec's only path.
    const teardown = await setupWebMCP(createStubRouter());
    teardown();
    expect(await modelContext.getTools()).toEqual([]);
  });

  it("refuses a tool the spec would not accept", async () => {
    stubBrowser();
    const modelContext = installWebMCPPolyfill(toolLoader())!;
    const bad = [
      { name: "bad name", description: "Spaces are not allowed.", execute: () => null },
      { name: "no_description", description: "", execute: () => null },
    ];
    for (const tool of bad) {
      await expect(modelContext.registerTool(tool)).rejects.toMatchObject({
        name: "InvalidStateError",
      });
    }
    expect(window.__webmcp_registered_tools?.size ?? 0).toBe(0);
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

describe("config redirects", () => {
  // An agent works from links it collected earlier — a search result, a URL a
  // user pasted, a path from an older copy of the docs — so it lands on moved
  // paths far more often than a visitor clicking through the current nav. Every
  // tool that takes a path resolves the docs config's `redirects` first, on the
  // same map (and with the same one-hop semantics) the router uses.

  it("navigates through an exact redirect and says where it came from", async () => {
    const router = createStubRouter("/");
    const result: any = await toolsByName(router).navigate.execute({ path: "/deploy" });
    // The router owns executing the redirect, so it is handed the agent's path.
    expect((router as any).push).toHaveBeenCalledWith({ path: "/deploy", hash: undefined });
    expect(result).toMatchObject({
      navigated: true,
      redirectedFrom: "/deploy",
      path: "/guide/deploy",
      title: "Deploy",
    });
  });

  it("navigates through a wildcard redirect, tail and all", async () => {
    const router = createStubRouter("/");
    await expect(
      toolsByName(router).navigate.execute({ path: "/docs/guide/deploy" }),
    ).resolves.toMatchObject({ redirectedFrom: "/docs/guide/deploy", path: "/guide/deploy" });
  });

  it("reports an off-site redirect instead of describing the page being left", async () => {
    // `window.location.replace` takes the tab; this document is on its way out,
    // so a page snapshot would describe the page the visitor is leaving.
    const router = createStubRouter("/guide");
    const result: any = await toolsByName(router).navigate.execute({ path: "/changelog" });
    expect((router as any).push).toHaveBeenCalledWith({ path: "/changelog", hash: undefined });
    expect(result).toEqual({
      navigated: true,
      external: true,
      redirectedFrom: "/changelog",
      url: "https://github.com/unjs/undocs/releases",
    });
  });

  it("still refuses a redirect that lands on nothing, naming both paths", async () => {
    const router = createStubRouter("/");
    await expect(toolsByName(router).navigate.execute({ path: "/docs/nope" })).rejects.toThrow(
      /`\/docs\/nope` redirects to `\/nope`/,
    );
    expect((router as any).push).not.toHaveBeenCalled();
  });

  it("reads the page a redirect points at", async () => {
    // `/raw/deploy.md` has no content-index entry — without resolving first this
    // is a 404 on a page the site happily serves.
    const { text, data } = unwrap(await toolsByName().read_page.execute({ path: "/deploy" }));
    expect(data).toMatchObject({
      path: "/guide/deploy",
      redirectedFrom: "/deploy",
      title: "Deploy",
    });
    expect(text).toContain("Deploy to Vercel");
  });

  it("tells an agent to open an off-site redirect rather than read it", async () => {
    await expect(toolsByName().read_page.execute({ path: "/changelog" })).rejects.toThrow(
      /outside this documentation site/,
    );
  });
});
