/**
 * AppPage → the `<router-view>` equivalent, with a per-page `<Suspense>`.
 *
 * Reads the current route's resolved component from the router
 * (`router.component`) and renders it inside a `<Suspense>`, keyed by
 * `route.path`. The reused pages have async `<script setup>` (top-level
 * `await useAsyncData`), so the page must sit inside a Suspense boundary.
 * Wrapping *inside* AppPage (rather than around the whole app) keeps the app
 * chrome (header/footer/search from `app.vue`) mounted across navigations while
 * each page resolves its own async setup.
 *
 * Keying by `route.path` remounts the component when navigating between two
 * paths served by the SAME record (e.g. two docs pages), re-running its async
 * setup. Because the key changes on an existing `<Suspense>`, Vue keeps the
 * previous page visible until the new page resolves — no blank flash.
 *
 * `<Suspense>`'s `resolve` event tells the router the new page is committed,
 * which ends any in-flight View Transition (see `router.ts`).
 */
import { defineComponent, h, onErrorCaptured, Suspense } from "vue";
import { useRouter, useRoute } from "@app/router";

export default defineComponent({
  name: "AppPage",
  inheritAttrs: false,
  setup(_props, { attrs }) {
    const router = useRouter();
    const route = useRoute();

    // A rejected async setup (e.g. `createError(404)`) makes Suspense emit ERROR,
    // not `resolve`, so `_pageRendered` would never fire and hang the View
    // Transition. Release it here; error still propagates to main.ts's root boundary.
    onErrorCaptured(() => {
      router._pageRendered();
    });

    return () => {
      const Component = router.component.value;
      return h(
        Suspense,
        { ...attrs, onResolve: () => router._pageRendered() },
        {
          default: () => (Component ? h(Component, { key: route.path }) : null),
        },
      );
    };
  },
});
