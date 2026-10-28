import { describe, it, expect } from "vitest";
import { isColoredIcon, isEmojiIcon } from "../../src/app/utils/icons.ts";

describe("isEmojiIcon", () => {
  it("treats Iconify names containing digits as icons, not emoji", () => {
    for (const icon of [
      "ri:image-2-line",
      "i-ri-image-2-line",
      "mdi:numeric-1",
      "tabler:h-1",
      "ph:hash",
    ]) {
      expect(isEmojiIcon(icon), icon).toBe(false);
    }
  });

  it("recognises emoji, including flags and keycaps", () => {
    for (const icon of ["🚀", "⚡️", "❤", "👩‍💻", "🇺🇸", "1️⃣", "#️⃣"]) {
      expect(isEmojiIcon(icon), icon).toBe(true);
    }
  });

  it("is false for a missing icon", () => {
    expect(isEmojiIcon()).toBe(false);
    expect(isEmojiIcon("")).toBe(false);
  });

  it("does not grey out a currentColor icon whose name contains a digit", () => {
    expect(isColoredIcon("ri:image-2-line")).toBe(false);
    expect(isColoredIcon("🚀")).toBe(true);
  });
});
