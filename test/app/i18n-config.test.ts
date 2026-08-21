import { describe, it, expect } from "vitest";
import { defu } from "defu";
import { applyNavPatch } from "../../src/app/composables/useLocaleDocsConfig.ts";
import type { NavItem } from "../../src/server/content/types.ts";

describe("locale docs config fallback (defu)", () => {
  const root = {
    name: "UnDocs",
    shortDescription: "Docs, made easy.",
    landing: {
      heroTitle: "UnDocs",
      heroSubtitle: "Docs, made easy.",
      features: [{ title: "Fast" }],
    },
    banner: { title: "Root banner" },
  };

  it("uses root landing when locale has no override", () => {
    const merged = defu({}, root);
    expect(merged.landing).toEqual(root.landing);
  });

  it("overrides only heroTitle and keeps other landing fields", () => {
    const merged = defu({ landing: { heroTitle: "Документация UnDocs" } }, root);
    expect(merged.landing.heroTitle).toBe("Документация UnDocs");
    expect(merged.landing.heroSubtitle).toBe("Docs, made easy.");
    expect(merged.landing.features).toEqual([{ title: "Fast" }]);
  });

  it("falls back banner to root when locale omits it", () => {
    const merged = defu({ landing: { heroTitle: "RU" } }, root);
    expect(merged.banner).toEqual(root.banner);
  });
});

describe("applyNavPatch", () => {
  const nav: NavItem[] = [
    {
      title: "Guide",
      path: "/guide",
      page: true,
      children: [{ title: "i18n", path: "/guide/i18n", page: true }],
    },
  ];

  it("patches titles by path", () => {
    const patched = applyNavPatch(nav, { "/guide": { title: "Гайд" } });
    expect(patched[0]!.title).toBe("Гайд");
    expect(patched[0]!.children?.[0]!.title).toBe("i18n");
  });

  it("hides items", () => {
    const patched = applyNavPatch(nav, { "/guide/i18n": { hide: true } });
    expect(patched[0]!.children).toEqual([]);
  });

  it("returns original nav without patch", () => {
    expect(applyNavPatch(nav, undefined)).toEqual(nav);
  });
});
