<script setup lang="ts">
import { useSlots } from "vue";
import { cn } from "@app/utils/cn";
// Based on Nuxt UI `UPageHeader` component. Page title/description block with `#headline` (above
// the title, e.g. breadcrumb) and `#links` (right-aligned actions) slots.
//
// `ui.wrapper` styles the title+links row (callers pass
// `flex-row items-center flex-wrap justify-between`); `ui.headline` styles the
// headline container.
defineProps<{
  title?: string;
  description?: string;
  ui?: {
    wrapper?: string;
    headline?: string;
    [key: string]: any;
  };
}>();

const slots = useSlots();
</script>

<template>
  <div class="mb-8 pb-6 border-b border-border">
    <div v-if="slots.headline" :class="cn('mb-4', ui?.headline)">
      <slot name="headline" />
    </div>

    <div :class="cn('flex flex-col gap-3', ui?.wrapper)">
      <h1 v-if="title" class="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
        {{ title }}
      </h1>

      <div v-if="slots.links" class="flex items-center flex-wrap gap-2 shrink-0">
        <slot name="links" />
      </div>
    </div>

    <p v-if="description" class="mt-3 text-lg text-muted-foreground">
      {{ description }}
    </p>

    <slot />
  </div>
</template>
