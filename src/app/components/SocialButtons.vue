<script setup lang="ts">
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
  external: boolean;
  active?: boolean;
}

// Reverse so the final social paints and hit-tests above the overlap.
const rowLinks = computed<RowLink[]>(() => {
  const socials = [...links.value].reverse().map((link) => ({ ...link, external: true }));
  return props.blog && blogLink.value
    ? [{ ...blogLink.value, external: false }, ...socials]
    : socials;
});

const overlapClass: Record<NonNullable<ButtonVariants["size"]>, string> = {
  xs: "-ml-1",
  sm: "-ml-2",
  md: "-ml-3",
  lg: "-ml-4",
};

const expandedOverlapClass: Record<NonNullable<ButtonVariants["size"]>, string> = {
  xs: "group-hover/socials:-ml-0.5 group-focus-within/socials:-ml-0.5",
  sm: "group-hover/socials:-ml-1 group-focus-within/socials:-ml-1",
  md: "group-hover/socials:-ml-1.5 group-focus-within/socials:-ml-1.5",
  lg: "group-hover/socials:-ml-2 group-focus-within/socials:-ml-2",
};

const stackedClass = computed(() =>
  props.stacked
    ? cn(
        "relative rounded-full hover:z-10",
        "transition-[margin-left,background-color,color] duration-200 ease-out",
        overlapClass[props.size],
        expandedOverlapClass[props.size],
        // Repeat `first:` for equal specificity in both expanded states.
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
