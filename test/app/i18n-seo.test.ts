import { describe, it, expect } from "vitest";
import {
  isSameLocalePath,
  localeAlternatePath,
  pageRouteForLocale,
  routeNameFromPath,
  shouldEmitLocaleSeo,
  resolveI18nConfig,
} from "../../src/app/utils/locale.ts";
import { uiMessages } from "../../src/shared/i18n-messages.ts";
import type { NavItem } from "../../src/server/content/types.ts";

describe("routeNameFromPath", () => {
  const codes = ["en", "ru"];

  it("maps home to index", () => {
    expect(routeNameFromPath("/", codes)).toBe("index");
    expect(routeNameFromPath("/ru", codes)).toBe("index");
  });

  it("joins path segments with dashes", () => {
    expect(routeNameFromPath("/guide/i18n", codes)).toBe("guide-i18n");
    expect(routeNameFromPath("/ru/guide/i18n", codes)).toBe("guide-i18n");
  });
});

describe("pageRouteForLocale", () => {
  it("falls back to index when no page routes", () => {
    expect(pageRouteForLocale("guide-i18n", "en", undefined)).toBe("index");
    expect(pageRouteForLocale("guide-i18n", "en", {})).toBe("index");
  });

  it("uses per-locale map; union still activates route for other locales", () => {
    const routes = { ru: ["guide"] };
    expect(pageRouteForLocale("guide", "ru", routes)).toBe("guide");
    // Union registration: en also gets merged root bucket for `guide`.
    expect(pageRouteForLocale("guide", "en", routes)).toBe("guide");
    expect(pageRouteForLocale("missing", "en", routes)).toBe("index");
  });

  it("legacy string[] list still works", () => {
    expect(pageRouteForLocale("guide", "en", ["guide"])).toBe("guide");
    expect(pageRouteForLocale("other", "en", ["guide"])).toBe("index");
  });
});

describe("setRoute index fallback (chrome messages)", () => {
  it("root UI dict still has toc.title for en/ru", () => {
    expect(uiMessages.en?.["toc.title"]).toBeTruthy();
    expect(uiMessages.ru?.["toc.title"]).toBeTruthy();
  });
});

describe("shouldEmitLocaleSeo", () => {
  it("requires enabled + baseUrl and respects disableMeta", () => {
    expect(shouldEmitLocaleSeo({ enabled: true, baseUrl: "https://x.dev" })).toBe(true);
    expect(
      shouldEmitLocaleSeo({ enabled: true, baseUrl: "https://x.dev", disableMeta: true }),
    ).toBe(false);
    expect(shouldEmitLocaleSeo({ enabled: true, baseUrl: undefined })).toBe(false);
    expect(shouldEmitLocaleSeo({ enabled: false, baseUrl: "https://x.dev" })).toBe(false);
  });
});

describe("localeAlternatePath", () => {
  const cfg = resolveI18nConfig({
    lang: "en",
    i18n: {
      locales: [
        { code: "en", displayName: "English" },
        { code: "ru", displayName: "Русский" },
      ],
    },
  });

  const nav: NavItem[] = [
    { title: "Guide", path: "/guide", page: true },
    {
      title: "Русский",
      path: "/ru",
      page: false,
      children: [{ title: "Guide", path: "/ru/guide", page: true }],
    },
  ];

  it("keeps existing locale page", () => {
    expect(localeAlternatePath("/guide", "ru", nav, cfg)).toBe("/ru/guide");
  });

  it("falls back to locale home when page missing", () => {
    expect(localeAlternatePath("/guide/missing", "ru", nav, cfg)).toBe("/ru");
  });
});

describe("isSameLocalePath", () => {
  const cfg = resolveI18nConfig({
    lang: "en",
    i18n: {
      locales: [
        { code: "en", displayName: "English" },
        { code: "ru", displayName: "Русский" },
      ],
    },
  });

  it("filters cross-locale hits", () => {
    expect(
      isSameLocalePath(
        "/guide",
        "en",
        cfg.localeCodes,
        cfg.defaultLocale,
        cfg.strategy,
        cfg.enabled,
      ),
    ).toBe(true);
    expect(
      isSameLocalePath(
        "/ru/guide",
        "en",
        cfg.localeCodes,
        cfg.defaultLocale,
        cfg.strategy,
        cfg.enabled,
      ),
    ).toBe(false);
  });

  it("passes all when i18n disabled", () => {
    const off = resolveI18nConfig({ lang: "en" });
    expect(
      isSameLocalePath(
        "/ru/guide",
        "en",
        off.localeCodes,
        off.defaultLocale,
        off.strategy,
        off.enabled,
      ),
    ).toBe(true);
  });
});

describe("usePageSEO has no disableMeta gate", () => {
  it("source does not short-circuit on disableMeta", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(
      resolve(import.meta.dirname, "../../src/app/composables/usePageSEO.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/disableMeta/);
  });
});
