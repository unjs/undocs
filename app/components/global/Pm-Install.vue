<script setup lang="ts">
const props = defineProps({
  name: { type: String, required: true },
})

const codeBlocks = computed(() =>
  packageManagers.map((pm) => ({
    filename: pm.name,
    code: `${pm.command} ${pm.install} ${props.name}`,
    key: pm.name,
  })),
)
</script>

<template>
  <ProseCodeGroup sync="pm">
    <ProsePre v-for="(codeBlock, index) in codeBlocks" :key="index" v-bind="codeBlock">
      <span style="color: var(--ui-primary)">{{ codeBlock.code.split(' ')[0] }}</span>
      <span style="color: var(--ui-text)">&nbsp;{{ codeBlock.code.split(' ').slice(1).join(' ') }}</span>
    </ProsePre>
  </ProseCodeGroup>
</template>
