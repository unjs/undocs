<script setup lang="ts">
import Avatar from "@app/components/ui/Avatar.vue";
import AppLink from "@app/components/app/AppLink";
defineProps<{
  name?: string;
  avatar?: { src?: string; alt?: string };
  to?: string;
  target?: string;
  description?: string;
}>();
</script>

<template>
  <component
    :is="to ? AppLink : 'div'"
    :to="to || undefined"
    :target="target"
    class="group flex items-center gap-3"
  >
    <Avatar :src="avatar?.src" :alt="avatar?.alt || name" size="md" />
    <div class="flex flex-col leading-tight">
      <span
        v-if="name"
        class="text-sm font-medium text-foreground group-hover:text-primary transition-colors"
      >
        {{ name }}
      </span>
      <span v-if="description" class="text-xs text-muted-foreground">
        {{ description }}
      </span>
    </div>
  </component>
</template>
