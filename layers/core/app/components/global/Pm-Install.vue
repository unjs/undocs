<script setup lang="ts">
const shiki = useShiki()
const props = defineProps({
  name: { type: String, required: true },
})

const codeBlocks = computed(() =>
  packageManagers
    .map((pm) => ({
      filename: pm.name,
      code: shiki(`${pm.command} ${pm.install} ${props.name}`, 'sh').value,
    }))
    .concat({
      // @ts-expect-error - Auto is a custom entry
      filename: 'auto',
      code: shiki(`npx nypm i ${props.name}`, 'sh').value,
    }),
)

console.log(codeBlocks.value)

const codeGroup = ref()
onMounted(() => {
  if (codeGroup.value) {
    useSyncedPackageManager(codeBlocks, toRef(codeGroup.value, 'selectedIndex'))
  }
})
</script>

<template>
  <CodeGroup ref="codeGroup">
    <ProseCode v-bind="codeBlocks[0]" v-html="codeBlocks[0].code" />
    <ProseCode v-bind="codeBlocks[1]" v-html="codeBlocks[1].code" />
    <ProseCode v-bind="codeBlocks[2]" v-html="codeBlocks[2].code" />
    <ProseCode v-bind="codeBlocks[3]" v-html="codeBlocks[3].code" />
    <ProseCode v-bind="codeBlocks[4]" v-html="codeBlocks[4].code" />
  </CodeGroup>
</template>
