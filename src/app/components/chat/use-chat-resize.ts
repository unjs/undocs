import { onBeforeUnmount, onMounted, type Ref, ref } from "vue";
import { readCookie, writeCookie } from "./cookie.ts";

/** The width the reader dragged the rail to, in whole pixels. */
const COOKIE = "undocs-chat-rail";

/** Narrow enough that the composer still fits, wide enough to read code in. */
const MIN = 320;
const MAX = 720;

/** The page keeps the greater part of the screen, whatever the rail is dragged to. */
const SHARE = 0.6;

/** One step of a key, and the step a held modifier takes instead. */
const STEP = 16;
const LEAP = 64;

/**
 * The rail's own width, dragged by the edge it is docked along.
 *
 * The stylesheet gives `--chat-rail` its default, and this only writes the one the
 * reader chose — on the root element, where both the rail and the room the page
 * gives up for it read it from. Only the rail resizes: the sheet below `lg` is the
 * whole screen, so there is no edge to take.
 */
export function useChatResize(panel: Ref<HTMLElement | undefined>) {
  /** Zero until the reader has a width, which is the stylesheet's own default. */
  const width = ref(0);

  function clamp(next: number) {
    const max = Math.max(MIN, Math.min(MAX, globalThis.innerWidth * SHARE));
    return Math.round(Math.min(Math.max(next, MIN), max));
  }

  /** What the rail is now: the reader's width, or the one the stylesheet drew. */
  function current() {
    return width.value || panel.value?.offsetWidth || MIN;
  }

  function resize(next: number) {
    width.value = clamp(next);
    document.documentElement.style.setProperty("--chat-rail", `${width.value}px`);
  }

  /** A drag is followed to the edge of the screen, not to the edge of the handle. */
  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    // The pointer is dragging a border, so it must not select the text beside it.
    event.preventDefault();
    // The rail is under the pointer for as long as the drag lasts: the transition
    // that carries an open or a close would leave it 260ms behind the hand.
    document.documentElement.classList.add("chat-resizing");

    const move = (moving: PointerEvent) => resize(globalThis.innerWidth - moving.clientX);
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      document.documentElement.classList.remove("chat-resizing");
      writeCookie(COOKIE, String(current()));
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop, { once: true });
    handle.addEventListener("pointercancel", stop, { once: true });
  }

  /** The same edge, by key: left widens the rail, because left is where it grows. */
  function onKeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? LEAP : STEP;
    const by = event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0;
    if (!by) return;
    event.preventDefault();
    resize(current() + by);
    writeCookie(COOKIE, String(width.value));
  }

  /** A screen narrower than the width the reader left gives the page its share back. */
  function measure() {
    if (width.value) resize(width.value);
  }

  onMounted(() => {
    const stored = Number(readCookie(COOKIE));
    if (stored) resize(stored);
    globalThis.addEventListener("resize", measure);
  });

  onBeforeUnmount(() => {
    globalThis.removeEventListener("resize", measure);
    document.documentElement.classList.remove("chat-resizing");
  });

  return { onKeydown, onPointerDown };
}
