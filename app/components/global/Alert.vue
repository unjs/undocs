<template>
  <!-- https://ui.nuxt.com/pro/components/prose/callout -->
  <!-- https://icon-sets.iconify.design/ph -->
  <Callout :icon="icon" :color="color" :to="to" :target="target">
    <!-- <strong class="mr-1">{{ title }}</strong> -->
    <ContentSlot :use="$slots.default" unwrap="p" />
  </Callout>
</template>

<script setup lang="ts">
import type uiColors from '#ui-colors'

const props = defineProps({
  title: { type: String },
  icon: { type: String },
  color: { type: String as PropType<(typeof uiColors)[number]> },
  to: { type: String },
})

const target = computed(() => (props.to?.startsWith('https://') ? '_blank' : ''))
</script>
