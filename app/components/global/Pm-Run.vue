<script setup lang="ts">
const props = defineProps({
  script: { type: String, required: true },
})

const packageManagers = [
  { name: 'npm', command: 'npm', run: 'run ' },
  { name: 'yarn', command: 'yarn', run: '' },
  { name: 'pnpm', command: 'pnpm', run: '' },
  { name: 'bun', command: 'bun', run: 'run ' },
] as const

const mdcPkgManager = computed(() => {
  return (
    `::code-group \n` +
    packageManagers
      .map((pm) => {
        return `\`\`\`sh [${pm.name}]\n ${pm.command} ${pm.run}${props.script}\n\`\`\``
      })
      .join('\n')
  )
})
</script>

<template>
  <MDC :value="mdcPkgManager" />
</template>
