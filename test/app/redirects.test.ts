import { describe, it, expect } from "vitest";
import { normalizeRedirects, resolveRedirect } from "../../src/app/utils/redirects.ts";

// The docs-config `redirects` map feeds two consumers from one implementation:
// Nitro route rules (`nitro.config.ts`) and the client router. These cover the
// normalization + matching both rely on.

describe("normalizeRedirects", () => {
  it("returns an empty map for missing/invalid input", () => {
    expect(normalizeRedirects(undefined)).toEqual({});
    expect(normalizeRedirects(null)).toEqual({});
    expect(normalizeRedirects("nope")).toEqual({});
  });

  it("roots keys and drops unusable entries", () => {
    expect(
      normalizeRedirects({
        "/docs": "/guide",
        docs2: "/guide2",
        "/empty": "",
        "/number": 42,
        "": "/nowhere",
      }),
    ).toEqual({
      "/docs": "/guide",
      "/docs2": "/guide2",
    });
  });
});

describe("resolveRedirect", () => {
  const redirects = normalizeRedirects({
    "/docs": "/guide",
    "/old/**": "/new/**",
    "/legacy/**": "/guide",
    "/legacy/deep/**": "/guide/deep/**",
    "/external": "https://example.com/docs",
  });

  it("matches exact keys", () => {
    expect(resolveRedirect(redirects, "/docs")).toBe("/guide");
    expect(resolveRedirect(redirects, "/external")).toBe("https://example.com/docs");
  });

  it("returns undefined when nothing matches", () => {
    expect(resolveRedirect(redirects, "/guide")).toBeUndefined();
    // An exact key does NOT cover its subtree.
    expect(resolveRedirect(redirects, "/docs/intro")).toBeUndefined();
    // Sibling prefixes must not match on a partial segment.
    expect(resolveRedirect(redirects, "/older/thing")).toBeUndefined();
  });

  it("carries the tail over for `/**` → `/**`", () => {
    expect(resolveRedirect(redirects, "/old/a/b")).toBe("/new/a/b");
    // `**` also covers the base itself.
    expect(resolveRedirect(redirects, "/old")).toBe("/new");
  });

  it("sends a whole subtree to a fixed target", () => {
    expect(resolveRedirect(redirects, "/legacy/a/b")).toBe("/guide");
  });

  it("prefers the most specific wildcard base", () => {
    expect(resolveRedirect(redirects, "/legacy/deep/a")).toBe("/guide/deep/a");
  });

  it("does not resolve inherited object properties", () => {
    expect(resolveRedirect(normalizeRedirects({ "/docs": "/guide" }), "/toString")).toBeUndefined();
  });
});
