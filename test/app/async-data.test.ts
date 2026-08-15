import { describe, expect, it } from "vitest";
import { useAsyncData } from "@app/composables/useAsyncData.ts";

/**
 * `import.meta.server` is undefined under vitest (no `define`), so these run the
 * CLIENT branch of `useAsyncData` — which is the one that matters here: on a
 * client-side navigation every awaited entry holds the page's `<Suspense>`, so a
 * non-content block must not be awaited. See `useAsyncData`'s module header.
 */
describe("useAsyncData (client)", () => {
  it("awaits the fetch by default", async () => {
    const { data, status } = await useAsyncData("t-eager", async () => "value");
    expect(data.value).toBe("value");
    expect(status.value).toBe("success");
  });

  it("does not block on `{ lazy: true }`, and fills in after", async () => {
    let started = false;
    const { data } = await useAsyncData(
      "t-lazy",
      async () => {
        started = true;
        return "value";
      },
      { lazy: true },
    );

    // The awaited call returned before the fetcher even ran — the page commits.
    expect(started).toBe(false);
    expect(data.value).toBe(null);

    // Deferred to a macrotask (there is no component instance here to hook
    // `onMounted` onto), then resolved reactively.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(data.value).toBe("value");
  });

  it("serves a lazy key from the hydration payload without refetching", async () => {
    // Payload-seeded entries are already in the store, so `lazy` never gets to
    // defer anything: the initial load of the landing page renders these blocks
    // server-side and hydrates them with data.
    let calls = 0;
    const first = await useAsyncData("t-lazy-cached", async () => ++calls, { lazy: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(first.data.value).toBe(1);

    const second = await useAsyncData("t-lazy-cached", async () => ++calls, { lazy: true });
    expect(second.data.value).toBe(1);
    expect(calls).toBe(1);
  });
});
