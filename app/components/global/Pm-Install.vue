<script setup lang="ts">
const props = defineProps({
  name: { type: String, required: true },
})

const codeBlocks = computed(() =>
  packageManagers
    .map((pm) => ({
      filename: pm.name,
      code: `${pm.command} ${pm.install} ${props.name}`,
      key: pm.name,
    }))
    .concat({
      filename: 'auto',
      code: `npx nypm i ${props.name}`,
      key: 'auto',
    }),
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
