import { describe, it, expect } from "vitest";
import { anchorTarget, isPlainLinkClick, type AnchorLike } from "@app/link-capture.ts";

/**
 * The two pure decisions behind the delegated click listener. Everything the
 * listener does around them is DOM plumbing (`composedPath`, `preventDefault`,
 * `router.push`) and needs a browser; these are where a wrong answer is a real
 * bug — one way the site full-reloads on an author's raw-HTML link, the other way
 * a modifier-click stops opening a new tab, or a `/raw/x.md` link 404s inside the
 * app instead of being served.
 */

const ORIGIN = "https://undocs.dev";

/** A stand-in for the anchor the listener finds, resolving `href` as a browser would. */
function anchor(attrs: Record<string, string>, base = `${ORIGIN}/guide/intro`): AnchorLike {
  const href = attrs.href;
  return {
    // `HTMLAnchorElement.href` is the RESOLVED URL; a `javascript:`/`mailto:`
    // href resolves to itself.
    href: href === undefined ? "" : new URL(href, base).href,
    getAttribute: (name) => attrs[name] ?? null,
    hasAttribute: (name) => name in attrs,
    target: attrs.target ?? "",
    relList: { contains: (token) => (attrs.rel ?? "").split(/\s+/).includes(token) },
  };
}

const click = (over: Partial<Parameters<typeof isPlainLinkClick>[0]> = {}) =>
  isPlainLinkClick({
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...over,
  });

describe("isPlainLinkClick", () => {
  it("accepts an unmodified primary click", () => {
    expect(click()).toBe(true);
  });

  it("declines a click somebody else already handled", () => {
    // `AppLink` calls `preventDefault` in its own handler, which runs before the
    // delegated one bubbles up — this is what stops a double navigation.
    expect(click({ defaultPrevented: true })).toBe(false);
  });

  it("declines everything the browser owns", () => {
    expect(click({ button: 1 })).toBe(false); // middle → new tab
    expect(click({ button: 2 })).toBe(false); // right → context menu
    expect(click({ metaKey: true })).toBe(false);
    expect(click({ ctrlKey: true })).toBe(false);
    expect(click({ shiftKey: true })).toBe(false); // new window
    expect(click({ altKey: true })).toBe(false); // download
  });
});

describe("anchorTarget", () => {
  it("routes a same-origin docs link, keeping query and fragment", () => {
    expect(anchorTarget(anchor({ href: "/guide/deploy" }), ORIGIN)).toBe("/guide/deploy");
    expect(anchorTarget(anchor({ href: "/guide/deploy?x=1#step-2" }), ORIGIN)).toBe(
      "/guide/deploy?x=1#step-2",
    );
  });

  it("resolves a relative href against the page it sits on", () => {
    // The case raw HTML in markdown actually produces: the author's anchor is
    // resolved by the browser, and we navigate to what it resolved to.
    expect(anchorTarget(anchor({ href: "deploy" }, `${ORIGIN}/guide/intro`), ORIGIN)).toBe(
      "/guide/deploy",
    );
    expect(
      anchorTarget(anchor({ href: "../reference/config" }, `${ORIGIN}/guide/intro`), ORIGIN),
    ).toBe("/reference/config");
  });

  it("leaves an absolute URL on another origin alone", () => {
    expect(anchorTarget(anchor({ href: "https://nitro.build/guide" }), ORIGIN)).toBe(null);
    expect(anchorTarget(anchor({ href: "//nitro.build/guide" }), ORIGIN)).toBe(null);
  });

  it("leaves a non-fetch scheme alone", () => {
    for (const href of ["mailto:hi@undocs.dev", "tel:+1234", "javascript:void 0"]) {
      expect(anchorTarget(anchor({ href }), ORIGIN), href).toBe(null);
    }
  });

  it("leaves a bare fragment to the browser's own scrolling", () => {
    // `AppLink` treats `#x` the same way, so the two agree.
    expect(anchorTarget(anchor({ href: "#installation" }), ORIGIN)).toBe(null);
  });

  it("ignores an anchor that is not a link", () => {
    expect(anchorTarget(anchor({}), ORIGIN)).toBe(null);
    expect(anchorTarget(anchor({ href: "" }), ORIGIN)).toBe(null);
  });

  it("respects download, a foreign target, and rel=external", () => {
    expect(anchorTarget(anchor({ href: "/guide/deploy", download: "" }), ORIGIN)).toBe(null);
    expect(anchorTarget(anchor({ href: "/guide/deploy", target: "_blank" }), ORIGIN)).toBe(null);
    expect(anchorTarget(anchor({ href: "/guide/deploy", target: "frame" }), ORIGIN)).toBe(null);
    expect(anchorTarget(anchor({ href: "/guide/deploy", rel: "noopener external" }), ORIGIN)).toBe(
      null,
    );
    // An explicit `_self` is still ours.
    expect(anchorTarget(anchor({ href: "/guide/deploy", target: "_self" }), ORIGIN)).toBe(
      "/guide/deploy",
    );
  });

  it("leaves server-answered paths to the server", () => {
    // The reason the predicate exists: each of these works today because the
    // browser makes a real request, and intercepting one renders a docs 404.
    for (const href of [
      "/llms-full.txt",
      "/raw/guide/intro.md",
      "/api/docs/search.json",
      "/icon.svg",
    ]) {
      expect(anchorTarget(anchor({ href }), ORIGIN), href).toBe(null);
    }
  });
});
