<!-- eslint-disable vue/no-v-html -->
<template>
  <Callout icon="i-ph-bookmark-simple-duotone" :to="to">
    <MDCSlot unwrap="p"> Read more in <span class="font-bold" v-html="computedTitle" />. </MDCSlot>
  </Callout>
</template>

<script setup lang="ts">
/**
 * Credit to Nuxt
 * https://github.com/nuxt/nuxt.com/blob/main/components/content/ReadMore.vue
 * https://github.com/nuxt/nuxt.com/blob/main/utils/index.ts
 */
import { splitByCase, upperFirst } from 'scule'

const props = defineProps({
  to: {
    type: String,
    required: false,
    default: '',
  },
  title: {
    type: String,
    required: false,
    default: '',
  },
})

const createBreadcrumb = (link: string = 'here') => {
  if (link.startsWith('http')) {
    return link.replace(/^https?:\/\//, '')
  }
  return link
    .split('/')
    .filter(Boolean)
    .map((part) =>
      splitByCase(part)
        .map((p) => upperFirst(p))
        .join(' '),
    )
    .join(' > ')
    .replace('Api', 'API')
}

// Guess title from link!
const computedTitle = computed<string>(() => props.title || createBreadcrumb(props.to))
</script>
