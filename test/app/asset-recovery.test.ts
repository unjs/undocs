import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Exercises the COMPILED `inline/asset-recovery.js` — the exact bytes
 * `entry-server.ts` inlines into `<head>` in production.
 *
 * The program is a listener plus a per-build attempt budget in sessionStorage,
 * so the fake below hands back a `fire()` to dispatch fake resource errors, a
 * `store` that persists across the reloads a test simulates, and a `reloads`
 * log instead of actually navigating. Timers are collected rather than run, so
 * the scheduled delay is asserted directly.
 */
const SCRIPT = readFileSync(
  fileURLToPath(new URL("../../src/app/inline/asset-recovery.js", import.meta.url)),
  "utf8",
);

const ENTRY_SRC = "/_undocs/main-abc123.js";

/** Load the program into a fresh document that shares `store` (one browser tab). */
function load(store: Map<string, string>, entrySrc: string = ENTRY_SRC) {
  let listener: ((event: unknown) => void) | undefined;
  let capture: boolean | undefined;

  const timers: { delay: number; run: () => void }[] = [];
  const reloads: string[] = [];

  const addEventListener = (type: string, fn: (event: unknown) => void, useCapture: boolean) => {
    if (type !== "error") return;
    listener = fn;
    capture = useCapture;
  };

  const document = {
    querySelector(selector: string) {
      if (!selector.includes("/_undocs/") || !entrySrc) return null;
      return { getAttribute: () => entrySrc };
    },
  };

  const sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };

  const location = {
    reload: () => void reloads.push("reload"),
  };

  const setTimeout = (run: () => void, delay: number) => void timers.push({ delay, run });

  const fn = new Function(
    "addEventListener",
    "document",
    "sessionStorage",
    "location",
    "setTimeout",
    SCRIPT,
  );
  fn(addEventListener, document, sessionStorage, location, setTimeout);

  return {
    get capture() {
      return capture;
    },
    /** Dispatch a fake resource-load error for `tagName` at `url`. */
    fire(tagName: string, url: string) {
      const target = tagName === "LINK" ? { tagName, href: url } : { tagName, src: url };
      listener?.({ target });
    },
    timers,
    reloads,
    /** Run every scheduled timer, as the browser eventually would. */
    flush() {
      for (const t of timers.splice(0)) t.run();
    },
  };
}

describe("asset-recovery script", () => {
  it("listens in the capture phase (resource errors don't bubble)", () => {
    expect(load(new Map()).capture).toBe(true);
  });

  it("schedules one delayed reload for a failed bundle asset", () => {
    const tab = load(new Map());
    tab.fire("SCRIPT", "/_undocs/chunk-9f8e7d.js");

    expect(tab.timers).toHaveLength(1);
    expect(tab.timers[0].delay).toBe(1500);
    expect(tab.reloads).toHaveLength(0); // not until the timer fires

    tab.flush();
    expect(tab.reloads).toHaveLength(1);
  });

  it("collapses a burst of failures into a single reload", () => {
    const tab = load(new Map());
    tab.fire("SCRIPT", "/_undocs/main-abc123.js");
    tab.fire("LINK", "/_undocs/css/main-1a2b3c.css");
    tab.fire("SCRIPT", "/_undocs/vendor/vue/chunk-4d5e6f.js");

    expect(tab.timers).toHaveLength(1);
  });

  it("ignores non-bundle assets and other elements", () => {
    const tab = load(new Map());
    tab.fire("SCRIPT", "https://plausible.example/script.js");
    tab.fire("LINK", "/favicon.ico");
    tab.fire("IMG", "/_undocs/img/hero.png");

    expect(tab.timers).toHaveLength(0);
  });

  it("escalates the delay, then gives up on the same build", () => {
    const store = new Map<string, string>();

    const first = load(store);
    first.fire("SCRIPT", ENTRY_SRC);
    expect(first.timers[0].delay).toBe(1500);

    // Each reload lands on the same (still-broken) build: a fresh document,
    // same sessionStorage.
    const second = load(store);
    second.fire("SCRIPT", ENTRY_SRC);
    expect(second.timers[0].delay).toBe(5000);

    // Budget spent — a persistent mismatch must fail visibly, not thrash.
    const third = load(store);
    third.fire("SCRIPT", ENTRY_SRC);
    expect(third.timers).toHaveLength(0);
  });

  it("resets the budget when the document names a new build", () => {
    const store = new Map<string, string>();

    for (const _ of [0, 1]) {
      const tab = load(store);
      tab.fire("SCRIPT", ENTRY_SRC);
      expect(tab.timers).toHaveLength(1);
    }
    const spent = load(store);
    spent.fire("SCRIPT", ENTRY_SRC);
    expect(spent.timers).toHaveLength(0);

    // A later deploy → different hashed entry → full recovery budget again.
    const fresh = load(store, "/_undocs/main-def456.js");
    fresh.fire("SCRIPT", "/_undocs/main-def456.js");
    expect(fresh.timers).toHaveLength(1);
    expect(fresh.timers[0].delay).toBe(1500);
  });

  it("does nothing when storage is blocked (can't prove it hasn't looped)", () => {
    const blocked = {
      get: () => {
        throw new Error("SecurityError");
      },
      set: () => {
        throw new Error("SecurityError");
      },
    } as unknown as Map<string, string>;

    const tab = load(blocked);
    tab.fire("SCRIPT", ENTRY_SRC);
    expect(tab.timers).toHaveLength(0);
  });
});
