<script setup lang="ts">
import AppLink from "@app/components/app/AppLink.ts";
import { computed } from "vue";

const props = defineProps<{
  href?: string;
  target?: string;
  rel?: string;
}>();

const isExternal = computed(() => !!props.href && /^https?:\/\//.test(props.href));
</script>

<template>
  <a
    v-if="isExternal"
    :href="href"
    :target="target || '_blank'"
    :rel="rel || 'noopener noreferrer'"
    class="prose-a"
  >
    <slot />
  </a>

  <AppLink v-else-if="href" :to="href" class="prose-a">
    <slot />
  </AppLink>

  <a v-else class="prose-a">
    <slot />
  </a>
</template>
