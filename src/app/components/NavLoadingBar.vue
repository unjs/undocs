<script setup lang="ts">
/**
 * Top progress bar shown during client navigations.
 *
 * The router flags `router.pending` while a navigation's page is loading (its
 * async `<Suspense>` in flight) and clears it once the page commits. We trickle
 * a thin bar toward ~90%, then fill to 100% and fade out on finish.
 *
 * A FAST navigation never flashes the bar: `pending` itself is deferred by
 * `PENDING_BAR_DELAY` (see `router.ts`), so only a load slower than that ever
 * flips it on.
 */
import { onUnmounted, ref, watch } from "vue";
import { useRouter } from "@app/router";

const router = useRouter();

const visible = ref(false);
const progress = ref(0);

let trickle: ReturnType<typeof setInterval> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function clearTimers() {
  if (trickle) clearInterval(trickle);
  if (hideTimer) clearTimeout(hideTimer);
  trickle = hideTimer = undefined;
}

function start() {
  clearTimers();
  visible.value = true;
  progress.value = 0;
  // Ease toward 90% and stop; the last 10% is filled by finish().
  trickle = setInterval(() => {
    progress.value = Math.min(90, progress.value + (90 - progress.value) * 0.12 + 0.4);
  }, 160);
}

function finish() {
  clearTimers();
  progress.value = 100;
  hideTimer = setTimeout(() => {
    visible.value = false;
    progress.value = 0;
  }, 250);
}

watch(
  () => router.pending.value,
  (pending) => (pending ? start() : finish()),
);

onUnmounted(clearTimers);
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 top-0 z-100 h-0.5 transition-opacity duration-200"
    :class="visible ? 'opacity-100' : 'opacity-0'"
    aria-hidden="true"
  >
    <div
      class="h-full bg-primary shadow-[0_0_8px_var(--color-primary)] transition-[width] duration-150 ease-out"
      :style="{ width: `${progress}%` }"
    />
  </div>
</template>
