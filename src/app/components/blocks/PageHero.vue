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

// The hero has ONE action. The first link is the filled CTA; everything after
// it drops below as a text link, at every breakpoint — a row of equally solid
// buttons reads as several primaries and none of them leads. This used to be a
// `max-sm:` treatment on the landing page only; it is now the hero's design, so
// an MDC `::page-hero` gets it too.
//
// Keyed on POSITION, like the `color: "brand"` the landing page hands the first
// link — the two have to agree about which link is the lead one.
const primaryLink = computed(() => props.links?.[0]);
const secondaryLinks = computed(() => props.links?.slice(1) || []);

// On mobile the lead CTA goes full-bleed; `sm:` and up it keeps its own size.
const primaryClass = "max-sm:h-12 max-sm:w-full max-sm:text-base";
// Strips the button surface back to a link. `border-transparent` rather than
// `border-0`: tailwind-merge keeps the width class from the variant either way,
// so the hairline stays in the box model and the labels don't shift by a pixel
// against the CTA above them.
//
// `hover:bg-transparent` is separate from `bg-transparent` on purpose: every
// variant's fill comes in a PAIR (`bg-* hover:bg-accent`), and tailwind-merge
// treats a modifier as part of the group key — so clearing the resting fill
// leaves the hover one, and the surface this class just stripped grows back
// under the pointer. The only cue left is the colour lift on the label.
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

          <!-- Links -->
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

        <!-- Aside / default slot -->
        <div v-if="hasAside" class="min-w-0" :class="isHorizontal ? '' : 'mt-16 w-full'">
          <slot />
        </div>
      </div>
    </Container>
  </section>
</template>
