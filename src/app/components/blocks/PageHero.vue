<script setup lang="ts">
import { computed, useSlots } from "vue";
import Button from "@app/components/ui/Button.vue";
import Container from "@app/components/Container.vue";
interface HeroLink {
  label?: string;
  icon?: string;
  to?: string;
  size?: string;
  color?: string;
  target?: string;
  [key: string]: unknown;
}

const props = withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    links?: HeroLink[];
    orientation?: "vertical" | "horizontal";
  }>(),
  {
    orientation: "vertical",
  },
);

const slots = useSlots();

const isHorizontal = computed(() => props.orientation === "horizontal");
const hasAside = computed(() => Boolean(slots.default));
</script>

<template>
  <section class="relative isolate overflow-hidden">
    <slot name="top" />

    <Container>
      <div
        class="py-16 sm:py-24 lg:py-32"
        :class="isHorizontal && hasAside ? 'grid lg:grid-cols-2 gap-x-8 gap-y-12 items-center' : ''"
      >
        <!-- Text column -->
        <div
          class="flex flex-col min-w-0"
          :class="
            isHorizontal ? 'items-start text-left' : 'items-center text-center mx-auto max-w-3xl'
          "
        >
          <!-- Headline -->
          <div v-if="slots.headline" class="mb-6">
            <slot name="headline" />
          </div>

          <!-- Title -->
          <h1
            class="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground text-balance"
          >
            <slot name="title">{{ title }}</slot>
          </h1>

          <!-- Description -->
          <p
            v-if="slots.description || description"
            class="mt-6 text-lg sm:text-xl text-muted-foreground text-pretty"
            :class="isHorizontal ? '' : 'max-w-2xl'"
          >
            <slot name="description">{{ description }}</slot>
          </p>

          <!-- Links -->
          <div
            v-if="slots.links || (links && links.length)"
            class="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap"
            :class="isHorizontal ? 'sm:justify-start' : 'sm:justify-center'"
          >
            <slot name="links">
              <Button v-for="link in links" :key="link.label" v-bind="link" />
            </slot>
          </div>
        </div>

        <!-- Aside / default slot -->
        <div v-if="hasAside" class="min-w-0" :class="isHorizontal ? '' : 'mt-16 w-full'">
          <slot />
        </div>
      </div>
    </Container>
  </section>
</template>
