import { describe, it, expect } from "vitest";
import { cn } from "../../src/app/utils/cn.ts";

/**
 * `cn()` runs every component's class list through tailwind-merge, whose job is
 * to drop the LOSER of a conflict. That makes a misclassified utility fail in the
 * quietest way available: the class simply is not in the output, and the element
 * renders with whatever it inherited.
 *
 * The Geist type scale walks straight into that. `text-heading-32` and
 * `text-button-14` are font SIZES, but tailwind-merge's built-in `text-*`
 * heuristic only recognises size-shaped suffixes (`sm`, `2xl`, `[13px]`), so it
 * files them as font colours — and a real colour in the same call then evicts
 * them. That is exactly what happened to the hero button: it lost its size and
 * rendered at the inherited one.
 */
describe("cn", () => {
  it("keeps a Geist size alongside a colour", () => {
    expect(cn("text-button-14", "text-primary-foreground")).toBe(
      "text-button-14 text-primary-foreground",
    );
    expect(cn("text-heading-32", "text-brand")).toBe("text-heading-32 text-brand");
    expect(cn("text-copy-16", "text-muted-foreground")).toBe("text-copy-16 text-muted-foreground");
  });

  it("still collapses two Geist sizes to the last one", () => {
    expect(cn("text-button-12", "text-button-14")).toBe("text-button-14");
    expect(cn("text-copy-16", "text-copy-14")).toBe("text-copy-14");
  });

  /** The two scales share one group, so they override each other either way. */
  it("resolves a Geist size against a Tailwind size", () => {
    expect(cn("text-sm", "text-button-14")).toBe("text-button-14");
    expect(cn("text-button-14", "text-sm")).toBe("text-sm");
  });

  it("still merges ordinary utilities", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("bg-muted", "bg-card")).toBe("bg-card");
  });
});
