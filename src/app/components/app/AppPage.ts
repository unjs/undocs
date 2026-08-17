// Key by path so catch-all pages rerun async setup. Both resolve and error must
// release the router's loading state.
import { defineComponent, h, onErrorCaptured, Suspense } from "vue";
import { useRouter, useRoute } from "@app/router.ts";

export default defineComponent({
  name: "AppPage",
  inheritAttrs: false,
  setup(_props, { attrs }) {
    const router = useRouter();
    const route = useRoute();

    // Suspense errors do not emit `resolve`.
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
