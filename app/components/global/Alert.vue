<template>
  <!-- https://ui.nuxt.com/pro/components/prose/callout -->
  <!-- https://icon-sets.iconify.design/ph -->
  <ProseCallout :icon="icon" :color="color" :to="to" :target="target">
    <!-- <strong class="mr-1">{{ title }}</strong> -->
    <slot mdc-unwrap="p" />
  </ProseCallout>
</template>

<script setup lang="ts">
import type uiColors from '#ui-colors'

const props = defineProps({
  title: { type: String, default: '' },
  icon: { type: String, default: '' },
  color: { type: String as PropType<(typeof uiColors)[number]>, default: '' },
  to: { type: String, default: '' },
})

const target = computed(() => (props.to?.startsWith('https://') ? '_blank' : ''))
</script>
