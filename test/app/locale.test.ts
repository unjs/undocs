import { describe, it, expect } from "vitest";
import {
  filterNavByLocale,
  getLocaleFromPath,
  localeHomePath,
  localizePath,
  resolveI18nConfig,
  stripLocalePrefix,
} from "../../src/app/utils/locale.ts";
import type { NavItem } from "../../src/server/content/types.ts";

describe("resolveI18nConfig", () => {
  it("falls back to a single locale from docs.lang", () => {
    const cfg = resolveI18nConfig({ lang: "fr" });
    expect(cfg.localeCodes).toEqual(["fr"]);
    expect(cfg.defaultLocale).toBe("fr");
    expect(cfg.enabled).toBe(false);
  });

  it("enables i18n when locales are explicitly configured (opt-in)", () => {
    const cfg = resolveI18nConfig({
      lang: "en",
      i18n: {
        locales: [
          { code: "en", displayName: "English" },
          { code: "ru", displayName: "Русский" },
        ],
      },
    });
    expect(cfg.enabled).toBe(true);
    expect(cfg.defaultLocale).toBe("en");
    expect(cfg.strategy).toBe("prefix_except_default");
  });

  it("stays disabled with empty i18n.locales", () => {
    const cfg = resolveI18nConfig({ lang: "en", i18n: { locales: [] } });
    expect(cfg.enabled).toBe(false);
  });

  it("enables with a single listed locale (explicit opt-in)", () => {
    const cfg = resolveI18nConfig({
      lang: "en",
      i18n: { locales: [{ code: "en", displayName: "English" }] },
    });
    expect(cfg.enabled).toBe(true);
  });
});

describe("path helpers", () => {
  const codes = ["en", "ru"];

  it("detects locale from a prefixed path", () => {
    expect(getLocaleFromPath("/ru/guide", codes, "en")).toBe("ru");
    expect(getLocaleFromPath("/guide", codes, "en")).toBe("en");
    expect(getLocaleFromPath("/", codes, "en")).toBe("en");
  });

  it("strips and re-applies locale prefixes", () => {
    expect(stripLocalePrefix("/ru/guide/i18n", codes)).toBe("/guide/i18n");
    expect(localizePath("/guide", "ru", "en", "prefix_except_default", codes)).toBe("/ru/guide");
    expect(localizePath("/ru/guide", "en", "en", "prefix_except_default", codes)).toBe("/guide");
    expect(localeHomePath("ru", "en", "prefix_except_default")).toBe("/ru");
    expect(localeHomePath("en", "en", "prefix_except_default")).toBe("/");
  });
});

describe("filterNavByLocale", () => {
  const nav: NavItem[] = [
    { title: "Home", path: "/", page: true, root: true },
    {
      title: "Guide",
      path: "/guide",
      page: true,
      children: [{ title: "i18n", path: "/guide/i18n", page: true }],
    },
    {
      title: "Ru",
      path: "/ru",
      page: true,
      children: [
        { title: "Home RU", path: "/ru", page: true },
        {
          title: "Guide",
          path: "/ru/guide",
          page: true,
          children: [{ title: "i18n", path: "/ru/guide/i18n", page: true }],
        },
      ],
    },
  ];

  it("keeps default-locale entries and drops other locale roots", () => {
    const filtered = filterNavByLocale(nav, "en", "en", ["en", "ru"]);
    expect(filtered.map((i) => i.path)).toEqual(["/", "/guide"]);
  });

  it("unwraps the locale folder for a non-default locale", () => {
    const filtered = filterNavByLocale(nav, "ru", "en", ["en", "ru"]);
    expect(filtered.some((i) => i.path === "/ru/guide" || i.path === "/ru")).toBe(true);
    expect(filtered.every((i) => i.path === "/ru" || i.path.startsWith("/ru/"))).toBe(true);
  });
});
