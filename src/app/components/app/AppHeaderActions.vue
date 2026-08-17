<script setup lang="ts">
/**
 * AppHeaderActions — the header's action cluster.
 *
 * At `md+` (the shell threshold, where the search takes the header's own centre
 * track — see `SiteHeader`) there is room for the full row: the color-mode
 * button, the blog link, plus the same `SocialButtons` the footer uses — here in
 * their `stacked` shape, overlapped into one cluster that fans out on hover, so
 * a project with four socials does not spend the whole track on them. The
 * cluster is LAST in the row on purpose: it grows leftward against `ml-auto`, so
 * expanding nudges the two buttons beside it rather than reflowing anything
 * outside this track. Below that
 * the bar keeps only the brand and the hamburger, and the same links and the
 * same toggle live at the bottom of the drawer instead (`SiteHeader`'s
 * `#body-footer`, filled by `AppHeader`) — a tap the visitor is already making
 * for the nav, and the one that already carries the blog (`mobileNavLinks` keeps
 * it in the drawer's tree).
 *
 * The blog is an ICON here, matching the socials beside it: it is a single
 * destination rather than a section of the docs, so it reads as one of the
 * header's places to go instead of a tab in the section switcher
 * (`DocsSectionTabs`, where it used to sit at the trailing end). Inside the blog
 * it switches to `color="brand"`, whose hover is a wash of the accent itself —
 * one of the three surfaces `--brand` is derived against. Tinting the NEUTRAL
 * ghost instead would put the accent on that variant's neutral hover fill, which
 * is exactly the pairing `tokens.test.ts` fails on.
 */
import { useBlogLink } from "@app/composables/useBlogLink.ts";
import ColorModeButton from "@app/components/ColorModeButton.vue";
import SocialButtons from "@app/components/SocialButtons.vue";
import Button from "@app/components/ui/Button.vue";
import Tooltip from "@app/components/ui/Tooltip.vue";

const blog = useBlogLink();
</script>

<template>
  <div class="hidden items-center gap-1 md:flex">
    <ColorModeButton />
    <Tooltip v-if="blog" :text="blog.label">
      <Button
        :aria-label="blog.label"
        :aria-current="blog.active ? 'page' : undefined"
        :icon="blog.icon"
        :to="blog.to"
        size="lg"
        :color="blog.active ? 'brand' : 'neutral'"
        variant="ghost"
      />
    </Tooltip>
    <SocialButtons size="lg" stacked />
  </div>
</template>
