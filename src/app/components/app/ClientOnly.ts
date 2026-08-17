// Defer browser-only children until after hydration.
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
