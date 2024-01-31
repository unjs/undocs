<script setup lang="ts">
const props = defineProps({
  auto: {
    type: Boolean,
    required: false,
    default: false,
  },
  name: {
    type: String,
    required: true,
  },
  action: {
    type: String as PropType<'install' | 'remove'>,
    required: false,
    default: 'install',
  },
})

type PManagerMapNames = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'npx nypm@latest'
interface PManagerMapOpts {
  install: string
  remove: string
}

const packageManagers = new Map<PManagerMapNames, PManagerMapOpts>([
  [
    'npx nypm@latest',
    {
      install: 'add',
      remove: 'remove',
    },
  ],
  [
    'npm',
    {
      install: 'install',
      remove: 'remove',
    },
  ],
  [
    'yarn',
    {
      install: 'add',
      remove: 'remove',
    },
  ],
  [
    'pnpm',
    {
      install: 'add',
      remove: 'rm',
    },
  ],
  [
    'bun',
    {
      install: 'add',
      remove: 'rm',
    },
  ],
])

const mdcPkgManager = computed(() => {
  return (
    `::code-group \n` +
    [...packageManagers.entries()]
      .filter(([key]) => (props.auto ? true : key !== 'npx nypm@latest'))
      .map(([key, value]) => {
        const k = key === 'npx nypm@latest' ? 'Auto' : key
        return `\`\`\`bash [${k}]\n ${key} ${value[props.action]} ${props.name}\n\`\`\``
      })
      .join('\n')
  )
})
</script>

<template>
  <MDC :value="mdcPkgManager" />
</template>
