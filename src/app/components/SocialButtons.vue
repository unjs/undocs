<script setup lang="ts">
/**
 * SocialButtons — the site's social links as icon buttons.
 *
 * Two shapes. The default is a plain fragment: the caller supplies the flex row
 * and its gap (`AppFooter`, the drawer's foot in `AppHeader`), so the wrapper
 * below renders as `display: contents` and disappears from layout entirely.
 *
 * `stacked` is the header's shape (`AppHeaderActions`): the buttons overlap into
 * one cluster and fan out on hover/focus, trading a hover for the horizontal
 * space the header's centre track wants. Four things make it work:
 *
 * - **Overlap is negative `margin-left`, animated to the row's own `gap-1`.** It
 *   is the container's WIDTH that has to change — that is the space being saved —
 *   so a transform-only version would leave the collapsed cluster occupying the
 *   expanded footprint and save nothing. Growth is leftward (the cluster is the
 *   trailing item of an `ml-auto` row), so the pointer can never fall outside a
 *   box that only ever grows around it — no expand/collapse flicker — and the
 *   header's centred search does not move (it is a separate grid track).
 * - **The stacking order is TREE order, not `z-index`.** In-flow, non-positioned
 *   siblings paint in document order, so the last link (GitHub — `socialLinks`
 *   reverses config order for exactly this) sits on top and is also the one that
 *   never moves. The overlapped strip hit-tests to it too, which is what a stack
 *   should do. `hover:z-10` only lifts the one being pointed at.
 * - **Nothing gains a surface.** These stay the ghost icons the footer renders;
 *   only their spacing changes. A chip fill (or a hairline ring) would read as a
 *   deeper stack, but it also puts four filled circles permanently beside the
 *   ghost color-mode and blog buttons — so the overlap is bounded by the glyphs
 *   instead of by an occluding fill (see `overlapClass`).
 * - **It is CSS only.** No hover state in JS, so SSR and the first client render
 *   are identical (hydration parity).
 */
import { computed } from "vue";
import { useSocialLinks } from "@app/composables/useSocialLinks.ts";
import { cn } from "@app/utils/cn.ts";
import Button from "@app/components/ui/Button.vue";
import Tooltip from "@app/components/ui/Tooltip.vue";
import type { ButtonVariants } from "@app/components/ui/Button.ts";

const props = withDefaults(
  defineProps<{
    size?: NonNullable<ButtonVariants["size"]>;
    stacked?: boolean;
  }>(),
  {
    size: "md",
    stacked: false,
  },
);

const links = useSocialLinks();

// x <> github: config order puts GitHub first, the row wants it last — and, when
// stacked, on top (see above).
const socialLinks = computed(() => [...links.value].reverse());

// Each step overlaps by (button − glyph − 4px), against `Button.ts`'s box and
// icon size — i.e. deep enough to swallow BOTH buttons' inner padding and leave
// the glyphs 4px apart, the same gap at every size (roughly half the box at
// `lg`). That 4px is the whole budget: the buttons are transparent, so a deeper
// overlap has no fill to occlude with and just collides two logo marks' ink.
// Going past it needs a surface to hide behind, which is the one thing this
// cluster deliberately does not have (see above).
const overlapClass: Record<NonNullable<ButtonVariants["size"]>, string> = {
  xs: "-ml-1.5",
  sm: "-ml-3",
  md: "-ml-4",
  lg: "-ml-5",
};

const stackedClass = computed(() =>
  props.stacked
    ? cn(
        // No surface of its own: the buttons stay the ghost icons they are
        // everywhere else and only their SPACING changes. `rounded-full` is the
        // shape of the ghost hover fill, so the one lit under the pointer reads
        // as one of a cluster rather than as a square wedged between its
        // neighbours; `hover:z-10` lifts that fill clear of them.
        "relative rounded-full hover:z-10",
        "transition-[margin-left,background-color,color] duration-200 ease-out",
        // The first one anchors the left edge in both states.
        overlapClass[props.size],
        "first:ml-0 group-hover/socials:ml-1 group-focus-within/socials:ml-1 first:group-hover/socials:ml-0 first:group-focus-within/socials:ml-0",
      )
    : undefined,
);
</script>
<template>
  <div :class="stacked ? 'group/socials isolate flex items-center' : 'contents'">
    <Tooltip v-for="link of socialLinks" :key="link.label" :text="link.label">
      <Button
        :aria-label="link.label"
        :icon="link.icon"
        :to="link.to"
        :size="size"
        target="_blank"
        rel="noopener noreferrer"
        color="neutral"
        variant="ghost"
        :class="stackedClass"
      />
    </Tooltip>
  </div>
</template>
