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

// Position identifies the lead CTA here and in the landing-page color override.
const primaryLink = computed(() => props.links?.[0]);
const secondaryLinks = computed(() => props.links?.slice(1) || []);

const primaryClass = "max-sm:h-12 max-sm:w-full max-sm:text-base";
// Preserve the transparent border's box width and clear both base and hover fills.
const secondaryClass =
  "h-auto w-auto border-transparent bg-transparent hover:bg-transparent px-0 py-1 font-normal " +
  "shadow-none text-muted-foreground hover:text-foreground underline underline-offset-4";
</script>

<template>
  <section class="relative isolate overflow-hidden">
    <slot name="top" />

    <Container>
      <div
        class="py-16 sm:py-24 lg:py-32"
        :class="isHorizontal && hasAside ? 'grid lg:grid-cols-2 gap-x-8 gap-y-12 items-center' : ''"
      >
        <div
          class="flex flex-col min-w-0"
          :class="
            isHorizontal ? 'items-start text-left' : 'items-center text-center mx-auto max-w-3xl'
          "
        >
          <div v-if="slots.headline" class="mb-6">
            <slot name="headline" />
          </div>

          <!-- The glow is `--brand`, like the landing backdrop it usually sits on,
               so it defaults to a neutral halo under `mono` and picks up the
               project's accent when one is set. -->
          <h1
            class="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground text-balance [text-shadow:0_0_2.5rem_color-mix(in_oklab,var(--brand)_25%,transparent)]"
          >
            <slot name="title">{{ title }}</slot>
          </h1>

          <!-- A `div`, not a `p`: the slot receives rendered markdown. A one-line
               fill arrives unwrapped (see `unwrapSlotParagraphs` in the content
               transforms), but a multi-block one still carries its `<p>`s — and a
               nested paragraph is invalid HTML, repaired by the browser into a DOM
               that no longer matches the vdom, so hydration mismatches. Same
               reason in Card.vue and PageCard.vue. -->
          <div
            v-if="slots.description || description"
            class="mt-6 text-lg sm:text-xl text-muted-foreground text-pretty"
            :class="isHorizontal ? '' : 'max-w-2xl'"
          >
            <slot name="description">{{ description }}</slot>
          </div>

          <div
            v-if="slots.links || (links && links.length)"
            class="mt-10 flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center sm:gap-6"
            :class="isHorizontal ? 'items-start' : 'items-center'"
          >
            <slot name="links">
              <Button v-if="primaryLink" v-bind="primaryLink" :class="primaryClass" />
              <div
                v-if="secondaryLinks.length"
                class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-x-6 sm:gap-y-2"
                :class="isHorizontal ? 'items-start' : 'items-center'"
              >
                <Button
                  v-for="link in secondaryLinks"
                  :key="link.label"
                  v-bind="link"
                  :class="secondaryClass"
                />
              </div>
            </slot>
          </div>
        </div>

        <div v-if="hasAside" class="min-w-0" :class="isHorizontal ? '' : 'mt-16 w-full'">
          <slot />
        </div>
      </div>
    </Container>
  </section>
</template>
