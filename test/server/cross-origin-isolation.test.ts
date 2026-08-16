import { describe, it, expect, vi, afterEach } from "vitest";
import {
  normalizeCrossOriginIsolation,
  crossOriginIsolationHeaders,
} from "../../src/server/cross-origin-isolation.ts";

// The docs-config `crossOriginIsolation` flag becomes response headers on the
// `/**` route rule in `nitro.config.ts`. These cover the normalization that
// stands between an author's YAML and those headers — including the two ways it
// can be off (unset, and a value that does not name a real COEP policy).

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeCrossOriginIsolation", () => {
  it("is off unless asked for", () => {
    expect(normalizeCrossOriginIsolation(undefined)).toBeUndefined();
    expect(normalizeCrossOriginIsolation(null)).toBeUndefined();
    expect(normalizeCrossOriginIsolation(false)).toBeUndefined();
  });

  it("maps `true` to the credentialless policy", () => {
    expect(normalizeCrossOriginIsolation(true)).toBe("credentialless");
  });

  it("passes an explicit policy through", () => {
    expect(normalizeCrossOriginIsolation("credentialless")).toBe("credentialless");
    expect(normalizeCrossOriginIsolation("require-corp")).toBe("require-corp");
  });

  it("warns and stays off for a value that is not a policy", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeCrossOriginIsolation("require_corp")).toBeUndefined();
    expect(normalizeCrossOriginIsolation("same-origin")).toBeUndefined();
    expect(normalizeCrossOriginIsolation(1)).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn.mock.calls[0][0]).toContain("require_corp");
  });
});

describe("crossOriginIsolationHeaders", () => {
  it("returns nothing when isolation is off, so no rule is added", () => {
    expect(crossOriginIsolationHeaders(undefined)).toBeUndefined();
    expect(crossOriginIsolationHeaders(false)).toBeUndefined();
  });

  it("pairs COOP with the resolved COEP — both are required to isolate", () => {
    expect(crossOriginIsolationHeaders(true)).toEqual({
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-embedder-policy": "credentialless",
    });
    expect(crossOriginIsolationHeaders("require-corp")).toEqual({
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-embedder-policy": "require-corp",
    });
  });
});
