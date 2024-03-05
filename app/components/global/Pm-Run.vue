<script setup lang="ts">
const props = defineProps({
  script: { type: String, required: true },
})

const codeBlocks = computed(() =>
  packageManagers.map((pm) => ({
    filename: pm.name,
    code: `${pm.command} ${pm.run}${props.script}`,
    key: pm.name,
  })),
)

const codeGroup = ref()
onMounted(() => {
  if (codeGroup.value) {
    useSyncedPackageManager(codeBlocks, toRef(codeGroup.value, 'selectedIndex'))
  }
})
</script>

<template>
  <CodeGroup ref="codeGroup">
    <ProseCode v-for="(codeBlock, index) in codeBlocks" :key="index" v-bind="codeBlock">
      <pre><code>{{ codeBlock.code }}</code></pre>
    </ProseCode>
  </CodeGroup>
</template>
