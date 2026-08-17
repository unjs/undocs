<script setup lang="ts">
/**
 * SocialButtons — the site's social links as icon buttons.
 *
 * Two shapes. The default is a plain fragment: the caller supplies the flex row
 * and its gap (`AppFooter`, the drawer's foot in `AppHeader`), so the wrapper
 * below renders as `display: contents` and disappears from layout entirely.
 *
 * `blog` (the header only) LEADS the row with the blog link. It is already an
 * icon of the same weight sitting immediately beside these, and it is a place to
 * go rather than a section of the docs — so it joins the cluster instead of
 * standing next to it, and the header's action row spends its width on one group
 * rather than two. It is the one item here that is an internal route: no
 * `target`/`rel`, and inside the blog it takes `color="brand"` (a wash of the
 * accent — one of the three surfaces `--brand` is derived against; tinting the
 * neutral ghost would put the accent on that variant's neutral hover fill, the
 * pairing `tokens.test.ts` fails on) plus `aria-current`.
 *
 * `stacked` is the header's shape (`AppHeaderActions`): the buttons overlap into
 * one cluster and fan out on hover/focus, trading a hover for the horizontal
 * space the header's centre track wants. Four things make it work:
 *
 * - **Overlap is negative `margin-left`, animated to half of itself.** It
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
 *   deeper stack, but it also puts a row of filled circles permanently beside the
 *   ghost color-mode button — so the overlap is bounded by the glyphs instead of
 *   by an occluding fill (see `overlapClass`).
 * - **It is CSS only.** No hover state in JS, so SSR and the first client render
 *   are identical (hydration parity).
 */
import { computed } from "vue";
import { useSocialLinks } from "@app/composables/useSocialLinks.ts";
import { useBlogLink } from "@app/composables/useBlogLink.ts";
import { cn } from "@app/utils/cn.ts";
import Button from "@app/components/ui/Button.vue";
import Tooltip from "@app/components/ui/Tooltip.vue";
import type { ButtonVariants } from "@app/components/ui/Button.ts";

const props = withDefaults(
  defineProps<{
    size?: NonNullable<ButtonVariants["size"]>;
    stacked?: boolean;
    /** Lead the row with the blog link (the header's cluster — see above). */
    blog?: boolean;
  }>(),
  {
    size: "md",
    stacked: false,
    blog: false,
  },
);

const links = useSocialLinks();
const blogLink = useBlogLink();

interface RowLink {
  label: string;
  icon: string;
  to: string;
  /** Off-site, so it opens in a new tab; the blog is a route of this site. */
  external: boolean;
  active?: boolean;
}

// x <> github: config order puts GitHub first, the row wants it last — and, when
// stacked, on top (see above). The blog leads, so it is the one item the stack
// pushes AWAY from GitHub's anchor.
const rowLinks = computed<RowLink[]>(() => {
  const socials = [...links.value].reverse().map((link) => ({ ...link, external: true }));
  return props.blog && blogLink.value
    ? [{ ...blogLink.value, external: false }, ...socials]
    : socials;
});

// Collapsed, the overlap leaves the glyphs about HALF a glyph apart — per
// `--size-*` step, against `Button.ts`'s box and icon size. The buttons are
// transparent, so the spacing that reads is the one between the marks, not the
// one between the boxes; measure it there. Roughly 40% of the box, and the
// budget runs out not far below it: with no fill to occlude with, a deeper
// overlap has nothing to hide the neighbour behind and just collides two logo
// marks' ink.
const overlapClass: Record<NonNullable<ButtonVariants["size"]>, string> = {
  xs: "-ml-1",
  sm: "-ml-2",
  md: "-ml-3",
  lg: "-ml-4",
};

// Fanned out, the overlap HALVES rather than going to zero: the cluster relaxes,
// it does not disassemble into a plain row. Half the box overlap is a full
// doubling of the gap between the marks (8px → 16px at `lg`), which is what the
// eye reads, while the buttons' own padding keeps the row from opening a hole in
// the middle of the header. Both records must key the same sizes.
const expandedOverlapClass: Record<NonNullable<ButtonVariants["size"]>, string> = {
  xs: "group-hover/socials:-ml-0.5 group-focus-within/socials:-ml-0.5",
  sm: "group-hover/socials:-ml-1 group-focus-within/socials:-ml-1",
  md: "group-hover/socials:-ml-1.5 group-focus-within/socials:-ml-1.5",
  lg: "group-hover/socials:-ml-2 group-focus-within/socials:-ml-2",
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
        overlapClass[props.size],
        expandedOverlapClass[props.size],
        // The first one anchors the left edge in BOTH states — a negative margin
        // there would hang it outside the container it is hovered through. Its
        // two overrides carry the extra `first:` on purpose: `first:ml-0` alone
        // only ties with the fanned-out rule on specificity, and a tie is
        // settled by whatever order Tailwind happens to emit.
        "first:ml-0 first:group-hover/socials:ml-0 first:group-focus-within/socials:ml-0",
      )
    : undefined,
);
</script>
<template>
  <div :class="stacked ? 'group/socials isolate flex items-center' : 'contents'">
    <Tooltip v-for="link of rowLinks" :key="link.label" :text="link.label">
      <Button
        :aria-label="link.label"
        :aria-current="link.active ? 'page' : undefined"
        :icon="link.icon"
        :to="link.to"
        :size="size"
        :target="link.external ? '_blank' : undefined"
        :rel="link.external ? 'noopener noreferrer' : undefined"
        :color="link.active ? 'brand' : 'neutral'"
        variant="ghost"
        :class="stackedClass"
      />
    </Tooltip>
  </div>
</template>
