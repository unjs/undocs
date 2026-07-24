<script setup lang="ts">
import { computed } from "vue";
import { packageManagers } from "@app/utils/pm";
import ProseCodeGroup from "@app/content/ProseCodeGroup.vue";
import ProsePre from "@app/content/ProsePre.vue";
const props = defineProps({
  command: { type: String, required: true },
});

const codeBlocks = computed(() =>
  packageManagers.map((pm) => ({
    filename: pm.name,
    code: `${pm.x}${props.command}`,
    key: pm.name,
  })),
);
</script>

<template>
  <ProseCodeGroup sync="pm">
    <ProsePre v-for="(codeBlock, index) in codeBlocks" :key="index" v-bind="codeBlock">
      <span style="color: var(--ui-text); font-weight: 700">{{
        codeBlock.code.split(" ")[0]
      }}</span>
      <span style="color: var(--ui-text)"
        >&nbsp;{{ codeBlock.code.split(" ").slice(1).join(" ") }}</span
      >
    </ProsePre>
  </ProseCodeGroup>
</template>
