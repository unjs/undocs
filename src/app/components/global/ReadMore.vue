<!-- eslint-disable vue/no-v-html -->
<template>
  <ProseCallout icon="i-lucide-bookmark" :to="to">
    Read more in <span class="font-bold" v-html="computedTitle" />.
  </ProseCallout>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ProseCallout from "@app/content/ProseCallout.vue";
/**
 * Credit: https://github.com/nuxt/nuxt.com/blob/main/components/content/ReadMore.vue
 * https://github.com/nuxt/nuxt.com/blob/main/utils/index.ts
 */
import { splitByCase, upperFirst } from "scule";

const props = defineProps({
  to: {
    type: String,
    required: false,
    default: "",
  },
  title: {
    type: String,
    required: false,
    default: "",
  },
});

const createBreadcrumb = (link: string = "here") => {
  if (link.startsWith("http")) {
    return link.replace(/^https?:\/\//, "");
  }
  return link
    .split("/")
    .filter(Boolean)
    .map((part) =>
      splitByCase(part)
        .map((p) => upperFirst(p))
        .join(" "),
    )
    .join(" > ")
    .replace("Api", "API");
};

// Guess title from link!
const computedTitle = computed<string>(() => props.title || createBreadcrumb(props.to));
</script>
