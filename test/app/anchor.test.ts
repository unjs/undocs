import { describe, it, expect } from "vitest";
import { anchorId } from "../../src/app/utils/anchor.ts";

// `URL.hash`/`location.hash` hand back the SERIALIZED fragment, so the id a
// non-Latin heading carries (`установка`, stamped by the content builder) and
// the hash the router reads for it are not the same string. Every JS scroll
// path goes through here so the two meet.
describe("anchorId", () => {
  it("decodes a percent-encoded fragment back to the heading's id", () => {
    expect(anchorId(new URL("https://x/y#Установка").hash)).toBe("Установка");
    expect(anchorId(new URL("https://x/y#安装").hash)).toBe("安装");
    expect(anchorId(new URL("https://x/y#émoji-heading").hash)).toBe("émoji-heading");
  });

  it("leaves a plain ASCII fragment alone", () => {
    expect(anchorId("#options-2")).toBe("options-2");
    expect(anchorId("options-2")).toBe("options-2");
  });

  it("falls back to the raw text on a malformed escape", () => {
    expect(anchorId("#%zz")).toBe("%zz");
  });
});
