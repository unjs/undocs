<script setup lang="ts">
/**
 * AppHeaderActions — the header's action cluster, at two sizes.
 *
 * At `lg+` (where the search takes the header's own centre track, see
 * `SiteHeader`) there is room for the full row: the color-mode switch plus the
 * same `SocialButtons` the footer uses. Below that the search moves into this
 * right-hand cluster, so the row collapses to a single `...` trigger holding
 * every link AND the color-mode toggle — one fixed-width control whatever
 * `docs.socials` holds, sitting beside the search and the hamburger instead of
 * competing with them for the narrow track.
 *
 * The menu opens on hover as well as on click — these links were one hover-free
 * click away at every width before it existed, and `openOnHover` keeps them that
 * cheap for a pointer. It stays `:modal="false"` for the same reason: hovering
 * must not lock the page's scroll.
 *
 * The color-mode item is a checkbox item that keeps the menu OPEN on select
 * (`preventDefault()` on the cancellable select event, see `DropdownMenu`), so
 * the flip is visible where it was made. Its two client-only reads carry the
 * same gates `ColorModeSwitch` documents: the resolved mode reports the SSR
 * default until `mounted`, and `forced` (an embedder pinning the mode) only
 * removes the item after mount. The menu CONTENT is client-only anyway — the
 * portal is `v-if="isMounted"` — but the trigger's own `v-if` is rendered on the
 * server, so it may not read `forced` before then.
 */
import { computed, onMounted, ref } from "vue";
import { useColorMode } from "@app/composables/useColorMode.ts";
import { useSocialLinks } from "@app/composables/useSocialLinks.ts";
import Button from "@app/components/ui/Button.vue";
import ColorModeSwitch from "@app/components/ColorModeSwitch.vue";
import DropdownMenu from "@app/components/ui/DropdownMenu.vue";
import SocialButtons from "@app/components/SocialButtons.vue";

const links = useSocialLinks();
const cm = useColorMode();

const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

const isDark = computed(() => (mounted.value ? cm.value === "dark" : true));
const colorModeAvailable = computed(() => !(mounted.value && cm.forced));

interface MenuItem {
  label: string;
  icon?: string;
  to?: string;
  type?: "checkbox";
  checked?: boolean;
  onSelect?: (event?: Event) => void;
}

// Config order (GitHub first) top-to-bottom; the row reverses for itself. The
// color mode sits in its own group, so `DropdownMenu` draws a separator above it.
const items = computed<MenuItem[][]>(() => {
  const groups: MenuItem[][] = [];
  if (links.value.length) {
    groups.push(
      links.value.map((link) => ({
        label: link.label,
        icon: link.icon,
        to: link.to,
      })),
    );
  }
  if (colorModeAvailable.value) {
    groups.push([
      {
        label: "Dark mode",
        icon: isDark.value ? "i-lucide-moon" : "i-lucide-sun",
        type: "checkbox",
        checked: isDark.value,
        onSelect: (event?: Event) => {
          event?.preventDefault();
          cm.preference = isDark.value ? "light" : "dark";
        },
      },
    ]);
  }
  return groups;
});
</script>

<template>
  <div class="hidden items-center gap-1 lg:flex">
    <ColorModeSwitch />
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
        aria-label="More options"
        :class="[open && 'bg-accent']"
      />
    </DropdownMenu>
  </div>
</template>
