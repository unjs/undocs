<script setup lang="ts">
import { computed } from "vue";
import Icon from "@app/components/global/Icon.vue";
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

const isEmoji = computed(() => Boolean(props.icon && /\p{Emoji}/u.test(props.icon)));
const isHorizontal = computed(() => props.orientation === "horizontal");
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
    <div v-if="$slots.leading || icon" class="text-primary shrink-0">
      <slot name="leading">
        <span v-if="isEmoji" class="w-8 h-8 text-2xl leading-none">{{ icon }}</span>
        <Icon v-else :name="icon!" class="w-8 h-8" />
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
