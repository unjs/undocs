import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { localeOfPath } from "../../src/server/content/builder.ts";

describe("builder i18n", () => {
  it("does not hardcode TOC_TITLE", () => {
    const src = readFileSync(
      resolve(import.meta.dirname, "../../src/server/content/builder.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/TOC_TITLE/);
    expect(src).not.toMatch(/На этой странице/);
  });

  it("localeOfPath scopes surround to the same locale", () => {
    const codes = ["en", "ru"];
    expect(localeOfPath("/guide", codes, "en")).toBe("en");
    expect(localeOfPath("/ru/guide", codes, "en")).toBe("ru");
    // Same-locale surround rule: prev/next only when locales match
    const pageLocale = localeOfPath("/ru/guide/a", codes, "en");
    const prev = "/guide/a";
    const next = "/ru/guide/b";
    expect(localeOfPath(prev, codes, "en") === pageLocale).toBe(false);
    expect(localeOfPath(next, codes, "en") === pageLocale).toBe(true);
  });
});
