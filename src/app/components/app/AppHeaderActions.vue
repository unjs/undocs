<script setup lang="ts">
/**
 * AppHeaderActions — the header's action cluster.
 *
 * At `md+` (the shell threshold, where the search takes the header's own centre
 * track — see `SiteHeader`) there is room for the full row: the color-mode
 * button, plus the same `SocialButtons` the footer uses — here in their
 * `stacked` shape, overlapped into one cluster that fans out on hover, so a
 * project with four socials does not spend the whole track on them. The blog
 * rides INSIDE that cluster (`blog`, leading it) rather than beside it: it is an
 * icon of the same weight going to a place rather than a section, so two groups
 * here would be one more than the row has width for. The
 * cluster is LAST in the row: it grows leftward against `ml-auto`, so expanding
 * nudges the toggle beside it rather than reflowing anything outside this track.
 * That nudge is the accepted cost of this order — the two hovers are mutually
 * exclusive, so an OPEN accent grid never moves, only a resting toggle does.
 * Below that
 * the bar keeps only the brand and the hamburger, and the same links and the
 * same toggle live at the bottom of the drawer instead (`SiteHeader`'s
 * `#body-footer`, filled by `AppHeader`) — a tap the visitor is already making
 * for the nav, and the one that already carries the blog (`mobileNavLinks` keeps
 * it in the drawer's tree).
 *
 * The toggle joins that cluster VISUALLY without joining it structurally, which
 * is two small overrides here rather than a third shape in `SocialButtons`:
 *
 * - **`-mr-2`, against the row's `gap-1`.** Spacing in this row reads
 *   glyph-to-glyph, not box-to-box — the buttons are transparent ghosts with a
 *   16px mark in a 40px box. Two 40px boxes a `gap-1` apart put their marks 44px
 *   apart, against the stack's own 24px collapsed (32px fanned out), so the
 *   toggle read as an unrelated control that happened to land nearby. Pulling
 *   4px overlaps the boxes by 4 and lands the marks at 36px: closer than a
 *   stranger, wider than a stack member in either state. It is a RIGHT margin
 *   because the toggle leads the row — pulling the cluster toward the toggle
 *   rather than the toggle out of the row's left edge, so the cluster's own
 *   anchored right edge is untouched. The overlap only ever eats padding (12px
 *   of it on each side of the mark), and it resolves to the blog link: both it
 *   and this wrapper are positioned at `z-auto`, so tree order gives the strip
 *   to the later one — 4px off the outer edge of its box, nowhere near its
 *   glyph.
 * - **`rounded-full`.** The ghost hover fill is the only surface any of these
 *   buttons ever grows, so its SHAPE is what says whether they are one row of
 *   controls or two. `stackedClass` already rounds the socials (their fills have
 *   to read as one cluster); the default `rounded-md` left the toggle lighting
 *   up as a square at the end of a line of circles — the more obvious now that
 *   it is 4px from one of them.
 *
 * The color-mode button is wrapped in `ThemeColorPicker`, which expands a grid of
 * accent swatches downward out of it on hover and costs the row no width — the
 * only reason a second per-visitor appearance setting fits into a track this
 * tight. It is also why the toggle is the one control here with no `Tooltip`: the
 * hover is spoken for. That instance takes `color="brand"` (the drawer's does
 * not): the trigger for the accent grid is the one control that should be
 * WEARING the accent, and a swatch previewed under the pointer repaints it along
 * with the page. Under the default `mono` theme it is `--foreground` and reads as
 * neutral as its neighbours. The same swatches sit in flow at the foot of the
 * drawer below `md`, where there is no hover to reveal anything with.
 *
 * The blog is an ICON here, matching the socials it now stacks with: it is a
 * single destination rather than a section of the docs, so it reads as one of
 * the header's places to go instead of a tab in the section switcher
 * (`DocsSectionTabs`, where it used to sit at the trailing end). How it differs
 * from the socials around it — internal route, active state — is
 * `SocialButtons`' own story.
 */
import ColorModeButton from "@app/components/ColorModeButton.vue";
import ThemeColorPicker from "@app/components/ThemeColorPicker.vue";
import SocialButtons from "@app/components/SocialButtons.vue";
</script>

<template>
  <div class="hidden items-center gap-1 md:flex">
    <ThemeColorPicker class="-mr-2">
      <ColorModeButton color="brand" class="rounded-full" />
    </ThemeColorPicker>
    <SocialButtons size="lg" stacked blog />
  </div>
</template>
