<script setup lang="ts">
import { computed } from "vue";
import Icon from "@app/components/global/Icon.vue";
import { isColoredIcon, isEmojiIcon } from "@app/utils/icons.ts";
const props = withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    icon?: string;
    orientation?: "vertical" | "horizontal";
  }>(),
  {
    orientation: "vertical",
  },
);

const isEmoji = computed(() => isEmojiIcon(props.icon));
const isHorizontal = computed(() => props.orientation === "horizontal");

// An emoji or a multicolor Iconify set brings its own palette; desaturate it so
// the row of features reads as one. A `currentColor` icon is left alone — the
// filter would grey out the `--brand` it inherits from the wrapper.
const isColored = computed(() => isColoredIcon(props.icon));
</script>

<template>
  <div
    class="flex gap-4"
    :class="
      isHorizontal
        ? 'flex-row items-start'
        : 'flex-col items-center text-center sm:items-start sm:text-left'
    "
  >
    <div v-if="$slots.leading || icon" class="text-brand shrink-0">
      <slot name="leading">
        <span v-if="isEmoji" class="w-8 h-8 text-2xl leading-none grayscale">{{ icon }}</span>
        <Icon v-else :name="icon!" :class="['w-8 h-8', isColored && 'grayscale']" />
      </slot>
    </div>

    <div class="flex flex-col gap-1">
      <h3 v-if="title" class="text-base font-semibold text-foreground">
        {{ title }}
      </h3>
      <div
        v-if="$slots.description || description"
        class="text-sm text-muted-foreground text-pretty"
      >
        <slot name="description">{{ description }}</slot>
      </div>
    </div>
  </div>
</template>
