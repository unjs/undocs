/**
 * ClientOnly → renders its default slot only after mount.
 *
 * In pure CSR everything is client-side anyway, but components used inside
 * `<ClientOnly>` (e.g. a content-search dialog) can rely on browser APIs, so
 * we defer to `onMounted` and render the optional `#fallback` slot until then.
 */
import { defineComponent, onMounted, ref } from "vue";

export default defineComponent({
  name: "ClientOnly",
  setup(_props, { slots }) {
    const mounted = ref(false);
    onMounted(() => {
      mounted.value = true;
    });
    return () => (mounted.value ? slots.default?.() : (slots.fallback?.() ?? null));
  },
});
