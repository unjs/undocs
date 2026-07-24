<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@app/utils/cn";
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink";

/**
 * `::card` — a prose card usable inline in Markdown (and grouped by
 * `::card-group`). A lighter, in-content sibling of the landing `::page-card`
 * block. Renders as a link when `to` is set, otherwise a static `<div>`.
 */
const props = defineProps<{
  title?: string;
  description?: string;
  icon?: string;
  to?: string;
  target?: string;
  [key: string]: unknown;
}>();

const isEmoji = computed(() => Boolean(props.icon && /\p{Emoji}/u.test(props.icon)));
</script>

<template>
  <component
    :is="to ? AppLink : 'div'"
    :to="to || undefined"
    :target="target"
    :class="
      cn(
        'group not-prose no-underline! flex flex-col gap-1.5 rounded-lg border border-border bg-card text-card-foreground p-4 transition-colors',
        to && 'hover:border-primary/50 hover:bg-accent/40',
      )
    "
  >
    <div class="flex items-center gap-2.5">
      <slot name="leading">
        <span
          v-if="icon"
          class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary/15"
        >
          <span v-if="isEmoji" class="text-lg leading-none">{{ icon }}</span>
          <Icon v-else :name="icon" class="size-5" />
        </span>
      </slot>
      <h3 v-if="title" class="m-0! text-base! font-semibold text-foreground leading-tight">
        <slot name="title">{{ title }}</slot>
      </h3>
    </div>

    <p
      v-if="$slots.description || description"
      class="m-0! text-sm text-muted-foreground text-pretty leading-relaxed"
    >
      <slot name="description">{{ description }}</slot>
    </p>

    <div
      v-if="$slots.default"
      class="[&>*]:m-0! text-sm text-muted-foreground text-pretty leading-relaxed"
    >
      <slot />
    </div>
  </component>
</template>
