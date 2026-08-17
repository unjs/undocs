<script setup lang="ts">
import { cn } from "@app/utils/cn.ts";
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink.ts";
import { computed } from "vue";

const props = defineProps<{
  items?: { label?: string; icon?: string; to?: string }[];
  class?: unknown;
}>();

const lastIndex = computed(() => (props.items?.length ?? 1) - 1);
</script>

<template>
  <nav aria-label="Breadcrumb" :class="cn('flex items-center', props.class)">
    <ol class="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      <template v-for="(item, i) in items" :key="i">
        <li class="flex items-center gap-1.5">
          <AppLink
            v-if="item.to && i !== lastIndex"
            :to="item.to"
            class="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <Icon v-if="item.icon" :name="item.icon" class="size-4 shrink-0" />
            <span>{{ item.label }}</span>
          </AppLink>
          <span v-else class="flex items-center gap-1 font-medium text-foreground">
            <Icon v-if="item.icon" :name="item.icon" class="size-4 shrink-0" />
            <span>{{ item.label }}</span>
          </span>
        </li>
        <li v-if="i !== lastIndex" role="presentation" aria-hidden="true">
          <Icon name="i-lucide-chevron-right" class="size-4 shrink-0 text-muted-foreground/60" />
        </li>
      </template>
    </ol>
  </nav>
</template>
