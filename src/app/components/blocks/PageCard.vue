<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@app/utils/cn";
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink";
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
        'group flex flex-col gap-3 rounded-lg border border-border bg-card text-card-foreground p-6 transition-colors',
        to && 'hover:border-primary/50 hover:bg-accent/40',
      )
    "
  >
    <slot name="leading">
      <div v-if="icon" class="text-primary">
        <span v-if="isEmoji" class="text-3xl leading-none">{{ icon }}</span>
        <Icon v-else :name="icon" class="size-8" />
      </div>
    </slot>

    <div class="flex flex-col gap-1">
      <h3 v-if="title" class="text-base font-semibold text-foreground">
        <slot name="title">{{ title }}</slot>
      </h3>
      <p v-if="$slots.description || description" class="text-sm text-muted-foreground text-pretty">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>

    <slot />
  </component>
</template>
