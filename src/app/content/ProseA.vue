<script setup lang="ts">
import AppLink from "@app/components/app/AppLink";
import { computed } from "vue";

const props = defineProps<{
  href?: string;
  target?: string;
  rel?: string;
}>();

const isExternal = computed(() => !!props.href && /^https?:\/\//.test(props.href));
</script>

<template>
  <!-- External links open in a new tab with safe rel. -->
  <a
    v-if="isExternal"
    :href="href"
    :target="target || '_blank'"
    :rel="rel || 'noopener noreferrer'"
    class="prose-a"
  >
    <slot />
  </a>

  <!-- Internal links use AppLink for client-side navigation. -->
  <AppLink v-else-if="href" :to="href" class="prose-a">
    <slot />
  </AppLink>

  <!-- No href — render a plain anchor. -->
  <a v-else class="prose-a">
    <slot />
  </a>
</template>
