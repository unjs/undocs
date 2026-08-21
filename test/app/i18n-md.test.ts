import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("md i18n component registration", () => {
  it("registers i18n / i18n-t / I18nT in MarkdownRenderer", () => {
    const src = readFileSync(
      resolve(import.meta.dirname, "../../src/app/content/MarkdownRenderer.ts"),
      "utf8",
    );
    expect(src).toMatch(/i18n:\s*I18nMd/);
    expect(src).toMatch(/"i18n-t":\s*I18nMd/);
    expect(src).toMatch(/I18nT:\s*I18nMd/);
  });

  it("ships demo locale JSON keys", () => {
    const en = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "../../docs/locales/en.json"), "utf8"),
    );
    const ru = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "../../docs/locales/ru.json"), "utf8"),
    );
    expect(en["demo.intro"]).toBeTruthy();
    expect(ru["demo.intro"]).toBeTruthy();
  });
});
