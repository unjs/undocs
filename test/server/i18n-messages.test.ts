import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateAppConfig } from "../../src/server/app-config.ts";

describe("loadI18nMessages via generateAppConfig", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "undocs-i18n-cfg-"));
    await mkdir(join(dir, ".config"), { recursive: true });
    await writeFile(
      join(dir, ".config/docs.yaml"),
      `name: Test\ni18n:\n  locales: [en, ru]\n  defaultLocale: en\n`,
    );
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("keeps root messages free of __routes__ and stores page dicts separately", async () => {
    await mkdir(join(dir, "locales/pages/guide"), { recursive: true });
    await writeFile(join(dir, "locales/en.json"), JSON.stringify({ "toc.title": "On this page" }));
    await writeFile(
      join(dir, "locales/ru.json"),
      JSON.stringify({ "toc.title": "На этой странице" }),
    );
    await writeFile(
      join(dir, "locales/pages/guide/ru.json"),
      JSON.stringify({ "page.only": "только ru" }),
    );

    const cfg = await generateAppConfig(dir);
    expect(cfg.docs._i18nMessages.en.__routes__).toBeUndefined();
    expect(cfg.docs._i18nMessages.ru.__routes__).toBeUndefined();
    expect(cfg.docs._i18nRouteMessages.ru.guide).toEqual({ "page.only": "только ru" });
    expect(cfg.docs._i18nRouteMessages.en?.guide).toBeUndefined();
    expect(cfg.docs._i18nPageRoutes.ru).toContain("guide");
    expect(cfg.docs._i18nPageRoutes.en ?? []).not.toContain("guide");
  });
});
