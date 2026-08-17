<script setup lang="ts">
import { computed, useSlots } from "vue";
import { cn } from "@app/utils/cn.ts";
import Container from "@app/components/Container.vue";
import Grid from "@app/components/grid/Grid.vue";
import GridCell from "@app/components/grid/GridCell.vue";
import GridCross from "@app/components/grid/GridCross.vue";
import GridSystem from "@app/components/grid/GridSystem.vue";
const props = defineProps<{
  id?: string;
  title?: string;
  // Supplies the missing heading level when only child headings are visible.
  srTitle?: string;
  description?: string;
  framed?: boolean;
  ui?: {
    container?: string;
    header?: string;
    title?: string;
    description?: string;
    body?: string;
    [key: string]: string | undefined;
  };
}>();

const slots = useSlots();

const hasHeader = computed(() => Boolean(props.title || props.description || slots.actions));
</script>

<template>
  <section :id="id" class="relative scroll-mt-20">
    <Container :class="cn('py-12 sm:py-16', ui?.container)">
      <h2 v-if="!title && srTitle" class="sr-only">{{ srTitle }}</h2>

      <div
        v-if="hasHeader"
        :class="
          cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-8', ui?.header)
        "
      >
        <div class="min-w-0">
          <h2 v-if="title" :class="cn('text-heading-24 text-foreground text-balance', ui?.title)">
            {{ title }}
          </h2>
          <p
            v-if="description"
            :class="
              cn('mt-2 max-w-2xl text-copy-16 text-muted-foreground text-pretty', ui?.description)
            "
          >
            {{ description }}
          </p>
        </div>

        <div v-if="slots.actions" class="shrink-0">
          <slot name="actions" />
        </div>
      </div>

      <div :class="cn(hasHeader ? 'mt-6' : '', ui?.body)">
        <ul
          v-if="slots.features"
          class="grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0"
        >
          <slot name="features" />
        </ul>

        <GridSystem v-if="framed">
          <Grid :columns="1" :rows="1">
            <GridCross :column="1" :row="1" />
            <GridCross :column="2" :row="1" />
            <GridCross :column="1" :row="2" />
            <GridCross :column="2" :row="2" />
            <GridCell>
              <slot />
            </GridCell>
          </Grid>
        </GridSystem>
        <slot v-else />
      </div>
    </Container>
  </section>
</template>
