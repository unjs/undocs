<script setup lang="ts">
const props = defineProps({
  name: { type: String, required: true },
})

const packageManagers = [
  {
    name: 'auto',
    command: 'npx nypm',
    install: 'i',
    comment: 'auto detects package manager in your project',
  },
  { name: 'npm', command: 'npm', install: 'i', comment: '' },
  { name: 'yarn', command: 'yarn', install: 'add', comment: '' },
  { name: 'pnpm', command: 'pnpm', install: 'i', comment: '' },
  { name: 'bun', command: 'bun', install: 'i', comment: '' },
] as const

const mdcPkgManager = computed(() => {
  return (
    `::code-group \n` +
    packageManagers
      .map(
        (pm) =>
          `\`\`\`sh [${pm.name}]\n${pm.command} ${pm.install} ${props.name}${pm.comment ? ` # ${pm.comment}` : ''}\n\`\`\``,
      )
      .join('\n')
  )
})
</script>

<template>
  <MDC :value="mdcPkgManager" />
</template>
