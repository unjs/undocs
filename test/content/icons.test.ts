import { describe, it, expect } from "vitest";
import { resolveIcon, CommonIcons } from "../../src/server/content/icons";

describe("resolveIcon", () => {
  it("matches a known section pattern", () => {
    expect(resolveIcon("/guide")).toBe("i-lucide-book-open");
    expect(resolveIcon("/config")).toBe("i-lucide-settings");
    expect(resolveIcon("/blog")).toBe("i-lucide-file-text");
  });

  it("matches when the pattern is a substring of a segment", () => {
    expect(resolveIcon("/configuration")).toBe("i-lucide-settings");
  });

  it("returns undefined for unknown paths", () => {
    expect(resolveIcon("/random")).toBeUndefined();
    expect(resolveIcon("/")).toBeUndefined();
  });

  it("returns undefined when nesting is deeper than two levels", () => {
    expect(resolveIcon("/a/b/guide")).toBeUndefined();
  });

  it("defaults to empty path without throwing", () => {
    expect(resolveIcon()).toBeUndefined();
  });
});

describe("CommonIcons", () => {
  it("every entry has a pattern and an icon", () => {
    expect(CommonIcons.length).toBeGreaterThan(0);
    for (const entry of CommonIcons) {
      expect(typeof entry.pattern).toBe("string");
      expect(entry.icon).toMatch(/^i-lucide-/);
    }
  });
});
