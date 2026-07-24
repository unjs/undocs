<script setup lang="ts">
import { useSlots } from "vue";
import { cn } from "@app/utils/cn";
import AuraBackground from "@app/components/AuraBackground.vue";
import Container from "@app/components/Container.vue";
defineProps<{
  id?: string;
  title?: string;
  // Screen-reader-only heading. Used when a section has no VISIBLE `title` but
  // still needs an `<h2>` so the page's heading levels don't skip (e.g. the
  // landing's features sit between the hero `<h1>` and the feature `<h3>`s).
  srTitle?: string;
  description?: string;
  // Render a soft radial "aura" glow behind the section instead of a hard divider.
  aura?: boolean;
  ui?: {
    container?: string;
    body?: string;
    [key: string]: string | undefined;
  };
}>();

const slots = useSlots();
</script>

<template>
  <section :id="id" class="relative isolate scroll-mt-20">
    <AuraBackground v-if="aura" variant="section" />
    <Container :class="cn('py-16 sm:py-20 lg:py-24', ui?.container)">
      <!-- Accessible-only heading (keeps heading levels from skipping) -->
      <h2 v-if="!title && srTitle" class="sr-only">{{ srTitle }}</h2>

      <!-- Heading -->
      <div v-if="title || description" class="max-w-3xl mx-auto text-center">
        <h2
          v-if="title"
          class="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent pb-1"
        >
          {{ title }}
        </h2>
        <div
          v-if="title"
          class="mx-auto mt-4 h-1 w-12 rounded-full bg-gradient-to-r from-primary/0 via-primary to-primary/0"
        />
        <p v-if="description" class="mt-4 text-lg text-muted-foreground text-pretty">
          {{ description }}
        </p>
      </div>

      <div :class="cn(title || description ? 'mt-12' : '', ui?.body)">
        <!-- Features grid -->
        <ul
          v-if="slots.features"
          class="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0"
        >
          <slot name="features" />
        </ul>

        <slot />
      </div>
    </Container>
  </section>
</template>
