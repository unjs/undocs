<script setup lang="ts">
/**
 * SocialMenu — the header's social links, at two sizes.
 *
 * At `lg+` (where the search takes the header's own centre track, see
 * `SiteHeader`) there is room for the full row and it renders as one, the same
 * `SocialButtons` the footer uses. Below that the search moves into this
 * right-hand cluster, so the row collapses to a single `...` trigger holding
 * every link — one fixed-width control whatever `docs.socials` holds.
 *
 * The menu opens on hover as well as on click — these links were one hover-free
 * click away at every width before it existed, and `openOnHover` keeps them that
 * cheap for a pointer. It stays `:modal="false"` for the same reason: hovering
 * must not lock the page's scroll.
 */
import { computed } from "vue";
import { useSocialLinks } from "@app/composables/useSocialLinks.ts";
import Button from "@app/components/ui/Button.vue";
import DropdownMenu from "@app/components/ui/DropdownMenu.vue";
import SocialButtons from "@app/components/SocialButtons.vue";

const links = useSocialLinks();

// Config order (GitHub first) top-to-bottom; the row reverses for itself.
const items = computed(() =>
  links.value.map((link) => ({
    label: link.label,
    icon: link.icon,
    to: link.to,
  })),
);
</script>

<template>
  <div class="hidden items-center lg:flex">
    <SocialButtons size="lg" />
  </div>

  <div v-if="items.length" class="flex items-center lg:hidden">
    <DropdownMenu
      v-slot="{ open }"
      :modal="false"
      open-on-hover
      :items="items"
      :content="{ align: 'end' }"
      :ui="{ content: 'min-w-fit' }"
      size="sm"
    >
      <Button
        icon="i-lucide-ellipsis"
        size="lg"
        color="neutral"
        variant="ghost"
        aria-label="Social links"
        :class="[open && 'bg-accent']"
      />
    </DropdownMenu>
  </div>
</template>
