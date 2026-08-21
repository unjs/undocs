import { describe, it, expect } from "vitest";
import { isSameLocalePath, resolveI18nConfig } from "../../src/app/utils/locale.ts";

describe("i18n search locale filter", () => {
  const cfg = resolveI18nConfig({
    lang: "en",
    i18n: {
      locales: [
        { code: "en", displayName: "English" },
        { code: "ru", displayName: "Русский" },
      ],
    },
  });

  it("keeps same-locale hits only (shared helper)", () => {
    expect(
      isSameLocalePath(
        "/guide#x",
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
    expect(
      isSameLocalePath(
        "/ru/guide#x",
        "ru",
        cfg.localeCodes,
        cfg.defaultLocale,
        cfg.strategy,
        cfg.enabled,
      ),
    ).toBe(true);
  });
});
