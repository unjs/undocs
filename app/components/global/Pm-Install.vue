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
    <ProseCode v-bind="codeBlocks[0]">
      <pre><code>{{ codeBlocks[0].code }}</code></pre>
    </ProseCode>
    <ProseCode v-bind="codeBlocks[1]">
      <pre><code>{{ codeBlocks[1].code }}</code></pre>
    </ProseCode>
    <ProseCode v-bind="codeBlocks[2]">
      <pre><code>{{ codeBlocks[2].code }}</code></pre>
    </ProseCode>
    <ProseCode v-bind="codeBlocks[3]">
      <pre><code>{{ codeBlocks[3].code }}</code></pre>
    </ProseCode>
    <ProseCode v-bind="codeBlocks[4]">
      <pre><code>{{ codeBlocks[4].code }}</code></pre>
    </ProseCode>
  </CodeGroup>
</template>
