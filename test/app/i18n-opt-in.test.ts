import { describe, it, expect } from "vitest";
import { resolveI18nConfig } from "../../src/app/utils/locale.ts";

describe("i18n opt-in", () => {
  it("without docs.i18n stays monolingual (plugin path disabled)", () => {
    const cfg = resolveI18nConfig({ lang: "en" });
    expect(cfg.enabled).toBe(false);
    expect(cfg.localeCodes).toEqual(["en"]);
  });

  it("with docs.i18n.locales enables plugin + locale routes", () => {
    const cfg = resolveI18nConfig({
      i18n: {
        locales: [{ code: "en" }, { code: "de", displayName: "Deutsch" }],
      },
    });
    expect(cfg.enabled).toBe(true);
    expect(cfg.localeCodes).toContain("de");
  });
});
