<script setup lang="ts">
/**
 * ThemeColorPicker — the visitor's accent chooser.
 *
 * Wraps the color-mode toggle (`<ThemeColorPicker><ColorModeButton /></…>`) and
 * expands a GRID of accent swatches downward out of it on hover. The two
 * settings belong together — both are "how this site looks to me, not to
 * everyone" — and attaching one to the other costs the header no width at all,
 * which is the only reason a per-visitor accent fits in a chrome this dense.
 *
 * Downward and in a grid, not sideways in a line: a single row of eight is wider
 * than the search field it would have to cross, while a 4×2 block is about two
 * buttons wide and hangs in the empty space BELOW the bar, where nothing else in
 * the header is. Centred on the toggle, so what grows out of the button is
 * visibly anchored to it.
 *
 * The swatches are the whole control: no panel, no border, no surface behind
 * them. A pill drawn under them is what breaks the illusion — it boxes the
 * swatches and NOT the toggle, which turns one control expanding into a
 * rectangle that opened next to a button. Without it the grid and the toggle
 * share the header's own background, and the only thing that happened on hover
 * is that the control got taller. The chips are spaced tighter than the icons
 * beside them (`gap-1.5`) for the same reason: they have to read as ONE block of
 * marks, not as eight more buttons that appeared under the action row.
 *
 * They are ROUNDED SQUARES, not dots — `rounded-sm`, the same `--radius` ladder
 * the buttons and cards around them sit on, so the block reads as part of this
 * UI rather than as a swatch strip borrowed from a paint app. At 16px a 4px
 * radius is most of the way to a circle already; going the last step to
 * `rounded-full` is what makes them radio buttons, and a swatch that looks like
 * a radio invites a click where hovering is the point. Squares also pack a 4×2
 * grid with no optical gutter between the rows, which is what lets the block
 * stay two swatches tall without growing.
 *
 * It is a HOVER affordance, so it is desktop-only by construction: a touch
 * "hover" is a tap, and a tap here already means "toggle the mode", so
 * `pointerenter` ignores `pointerType === "touch"` the same way `Tooltip` does.
 * That is the whole of where the accent chooser lives — the mobile drawer
 * deliberately carries only light/dark (see `AppHeader`'s `#body-footer`). It
 * used to render the same swatches in flow there under a `layout="row"` prop;
 * both are gone, so this component is the popover and nothing else. Re-adding a
 * flow layout means re-arguing that a row of eight chips belongs at the foot of
 * a nav tree.
 *
 * Hovering a swatch PREVIEWS it — the accent applies to the whole page while the
 * pointer is on it and drops when the pointer leaves. That is the only honest
 * way to show what one of these does: `--brand` tints links, active nav, icons
 * and the landing glow, none of which a 16px filled chip predicts. Focus does
 * the same thing, so the keyboard sees the same site the mouse does. The preview
 * is never persisted, so leaving is the undo.
 *
 * The TRIGGER is one of the things that repaints: the header passes its
 * `ColorModeButton` `color="brand"` (`AppHeaderActions`), so the glyph the grid
 * grows out of is itself drawn in the live accent. Nothing here implements that —
 * `--brand` is a document-level variable and the preview already moves it — but
 * it is the reason the preview reads as a change to the SITE rather than to the
 * strip of swatches: the effect starts at the pointer and runs outward through
 * the control the visitor is holding.
 *
 * Three things are load-bearing:
 *
 * - **The grid is a CHILD of the wrapper, not a sibling.** It renders outside the
 *   wrapper's 40px box, and `pointerleave` only fires when the pointer leaves an
 *   element AND its descendants — so travelling from the button down into the
 *   swatches keeps the picker open with no grace-area timer, no polygon, and no
 *   module-level "in transit" state. The air between the button and the first
 *   row is the container's own PADDING for the same reason: a margin would be a
 *   strip belonging to neither, the pointer would cross it on the way down, and
 *   the grid would close under it.
 * - **`inert` while closed, not `hidden`.** The swatches stay mounted so their
 *   transitions have something to animate (a `v-if` removes the node in the same
 *   tick the exit class lands — the reason `usePresence` exists for the layers
 *   that DO unmount). `inert` is what keeps them out of the tab order and out of
 *   hit-testing meanwhile; opening on `focusin` means they are live by the time
 *   a Tab could reach them.
 * - **Nothing renders before mount.** The selection comes from `localStorage`,
 *   which the server cannot see, so the swatches are gated on `mounted` — the
 *   hydration-parity rule that also shapes `ColorModeButton`.
 *
 * With no pick stored, the swatch shown as selected is the DOCS PROJECT's own
 * accent (`themeColor`, resolved through the same alias table), so the picker
 * opens showing where the site already is rather than showing nothing. That also
 * means there is no separate "reset" affordance to explain: picking that swatch
 * again is a no-op the visitor can see.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { cn } from "@app/utils/cn.ts";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { useThemeColor } from "@app/composables/useThemeColor.ts";
import {
  THEME_COLORS,
  resolveThemeColor,
  themeColorToken,
  type ThemeColor,
} from "@app/theme-brand.ts";

const theme = useThemeColor();
const appConfig = useAppConfig();

const LABELS: Record<ThemeColor, string> = {
  mono: "Monochrome",
  blue: "Blue",
  purple: "Purple",
  pink: "Pink",
  red: "Red",
  amber: "Amber",
  green: "Green",
  teal: "Teal",
};

/** The project's own accent, as the swatch to show selected before any pick. */
const projectColor = computed(() => resolveThemeColor(appConfig.ui?.colors?.primary));
const selected = computed(() => theme.value ?? projectColor.value);

const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

// An embedder pinning the accent out-orders us in the cascade, so a pick here
// would do nothing — hide rather than lie. Gated on `mounted` for the same
// reason as everything else: `forced` is client-only.
const visible = computed(() => mounted.value && !theme.forced);

/**
 * Columns in the popover's grid — 8 colours as 4×2, about two buttons wide.
 * Tailwind scans source text, so the template spells `grid-cols-4` out and this
 * mirrors it for the stagger; the two have to move together.
 */
const COLUMNS = 4;
const rowOf = (index: number): number => Math.floor(index / COLUMNS);
const columnOf = (index: number): number => index % COLUMNS;

const open = ref(false);

function choose(color: ThemeColor): void {
  theme.value = color;
  theme.preview = null;
  open.value = false;
}

function onPointerEnter(event: PointerEvent): void {
  if (event.pointerType === "touch") return;
  open.value = true;
}

function onLeave(): void {
  open.value = false;
  // Whatever the pointer was over, it isn't now — never leave a preview behind
  // for a visitor who has moved on. This fires on the WRAPPER, so it also covers
  // a pointer that leaves a swatch by leaving the picker altogether.
  theme.preview = null;
}

function onFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget;
  const wrapper = event.currentTarget as HTMLElement;
  if (!(next instanceof Node) || !wrapper.contains(next)) {
    open.value = false;
    theme.preview = null;
  }
}

// The preview lives on shared state, so it outlives this component unless it is
// dropped here — a route change under a hovered swatch would otherwise leave the
// whole site wearing an accent nobody picked.
onBeforeUnmount(() => {
  theme.preview = null;
});
</script>

<template>
  <div
    class="relative"
    @pointerenter="onPointerEnter"
    @pointerleave="onLeave"
    @focusin="open = true"
    @focusout="onFocusOut"
    @keydown.escape="open = false"
  >
    <slot />

    <div
      v-if="visible"
      :inert="!open"
      role="group"
      aria-label="Accent color"
      :class="
        cn(
          // Centred under the toggle and out of flow, so the action row keeps its
          // collapsed width. `pt-2` — padding, never margin (see the pointer note
          // above) — is the air the grid hangs below the bar on. No surface of its
          // own: the control gets taller, a panel does not open.
          //
          // Centring is affordable only because the toggle LEADS the header's
          // action row (`AppHeaderActions`) with the socials to its right. The
          // grid is ~82px against a 40px button, so it hangs ~21px past each
          // side — fine over the socials and over the gap before the centre
          // track, but if the toggle ever becomes the trailing control it is
          // flush with `Container`'s content edge, where the gutter is 24px at
          // `md` and the swatches' focus ring and selected marker eat the rest of
          // it. Anchor it `right-0` then, not here.
          'absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2',
          // `w-max` is load-bearing, not tidying. An absolutely positioned box
          // with `left` set and `right: auto` is shrink-to-fit against the space
          // LEFT of its containing block's right edge — here the toggle's own
          // 40px box minus the 20px `left-1/2` offset — so the grid resolves to
          // about one swatch wide and stacks into a column. `width: max-content`
          // is what lets it be as wide as its tracks.
          'w-max',
          // Literal, because Tailwind scans source text: `grid-cols-4` has to be
          // spelled out here and mirrored by `COLUMNS`.
          'grid grid-cols-4 justify-items-center gap-1.5',
          'transition-[opacity,transform] duration-200 ease-out',
          open ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0',
        )
      "
    >
      <button
        v-for="(color, index) in THEME_COLORS"
        :key="color"
        type="button"
        :aria-label="LABELS[color]"
        :aria-pressed="selected === color"
        class="relative size-4 shrink-0 rounded-sm shadow-small transition-[transform,opacity] duration-200 ease-out hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-90"
        :class="open ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-1 scale-50 opacity-0'"
        :style="{
          background: themeColorToken(color),
          // Staggered on the way out, simultaneous on the way back: a grid that
          // unwound one swatch at a time would outlast the pointer. The stagger
          // runs by ROW, with a small offset along each — so the block falls out
          // of the button top row first, instead of eight marks appearing in an
          // order that has nothing to do with where they came from.
          transitionDelay: open ? `${rowOf(index) * 60 + columnOf(index) * 20}ms` : '0ms',
        }"
        @click="choose(color)"
        @pointerenter="theme.preview = color"
        @pointerleave="theme.preview = null"
        @focus="theme.preview = color"
        @blur="theme.preview = null"
      >
        <!--
          The selected marker rides 3px outside the chip, so it needs the chip's
          radius PLUS that offset to stay concentric — a ring at the same radius
          reads pinched at the corners. The chip is `rounded-sm`
          (`--radius - 2px`), hence `--radius + 1px` here: both track an embed
          that pins `--radius`, including 0, where the pair squares off together.
        -->
        <span
          v-if="selected === color"
          class="absolute -inset-[3px] rounded-[calc(var(--radius)_+_1px)] border-2"
          :style="{ borderColor: themeColorToken(color) }"
        />
      </button>
    </div>
  </div>
</template>
