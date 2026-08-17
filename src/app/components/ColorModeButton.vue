<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useColorMode } from "@app/composables/useColorMode.ts";
import Button from "@app/components/ui/Button.vue";
import type { ButtonVariants } from "@app/components/ui/Button.ts";
/**
 * ColorModeButton — the light/dark toggle, as one icon button.
 *
 * It used to be a sliding pill switch with its own hand-rolled `role="switch"` /
 * `data-state` markup. A switch states a fact ("dark mode: on"), which needs a
 * label to say WHICH fact and a thumb position to read it off; the control has
 * exactly one job, and the button says it in one glyph. So it is now the same
 * `Button` (`ghost`/`neutral`, icon-only) the socials and the blog link beside
 * it in `AppHeaderActions` render — one control shape across the whole action
 * cluster, one hover fill, one focus ring, and the `--size-*` ladder instead of
 * a bespoke `h-6 w-11`.
 *
 * The glyph is the CURRENT mode (moon in dark, sun in light) and the label is
 * the ACTION ("Switch to light mode"), which is the pairing a visitor reads
 * fastest: the icon answers "what am I in", the `aria-label` answers "what does
 * this do". It is a plain button, not `aria-pressed` — the label already changes
 * with the state, and announcing "pressed" on top of it says the same thing
 * twice, differently.
 *
 * It carries NO `Tooltip`, unlike the socials and the blog link beside it. In
 * the header it is wrapped by `ThemeColorPicker`, so hovering it already reveals
 * something — the accent swatches, expanding below it — and a label popping up
 * above at the same time makes one gesture answer with two floating things at
 * once. The
 * `aria-label` is unaffected, so nothing is lost to a screen reader.
 *
 * The resolved mode is client-only (localStorage / system preference), so we
 * report the SSR default (dark, matching the shell's `<html class="dark">`)
 * until mounted, keeping the server and first client render identical.
 *
 * Rendered in the header's action row at `md+` and at the foot of the mobile
 * drawer below that (`AppHeader`'s `#body-footer`).
 */
const props = withDefaults(
  defineProps<{
    /**
     * `brand` paints the glyph in the LIVE accent (`--brand`), which is what the
     * header instance takes: it is `ThemeColorPicker`'s trigger, so the control
     * that opens the accent grid also wears the accent, and hovering a swatch
     * previews onto the trigger itself. It costs nothing under the default
     * `mono` theme, where `--brand` IS `--foreground` and the button is
     * indistinguishable from its neutral neighbours — the tint appears exactly
     * when there is a hue to report. The drawer's copy stays `neutral`: the
     * swatches sit beside it in flow there, so it is not standing in for them.
     */
    color?: NonNullable<ButtonVariants["color"]>;
    /**
     * Merged into `Button`'s own classes (so it wins through `cn()` — a bare
     * fallthrough attr would only CONCATENATE, leaving `rounded-md` to fight
     * `rounded-full` on stylesheet order). The header passes `rounded-full`, to
     * match the circular ghost hover of the stacked socials it now sits beside;
     * the drawer's copy takes the default, where those socials are unstacked and
     * square.
     */
    class?: unknown;
  }>(),
  { color: "neutral" },
);

const cm = useColorMode();

const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

const isDark = computed(() => (mounted.value ? cm.value === "dark" : true));

const label = computed(() => (isDark.value ? "Switch to light mode" : "Switch to dark mode"));

// An embedder pinning the mode via the URL fragment makes the toggle a no-op —
// hide it. Gated on `mounted` for the same reason as `isDark`: `forced` is
// client-only, so the first client render must still match the SSR output.
const hidden = computed(() => mounted.value && cm.forced);

function toggle() {
  cm.preference = isDark.value ? "light" : "dark";
}
</script>

<template>
  <Button
    v-if="!hidden"
    :aria-label="label"
    :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
    size="lg"
    :color="props.color"
    variant="ghost"
    :class="props.class"
    @click="toggle"
  />
</template>
