<script setup lang="ts">
const props = defineProps({
  icon: {
    type: String,
    default: undefined,
  },
  filename: {
    type: String,
    default: undefined,
  },
})

const config = {
  '.config': 'vscode-icons:file-type-config',
  // '.plugin': 'vscode-icons:file-type-plugin',
  'package.json': 'vscode-icons:file-type-node',
  'tsconfig.json': 'vscode-icons:file-type-tsconfig',
  '.npmrc': 'vscode-icons:file-type-npm',
  '.editorconfig': 'vscode-icons:file-type-editorconfig',
  '.eslintrc': 'vscode-icons:file-type-eslint',
  '.eslintrc.cjs': 'vscode-icons:file-type-eslint',
  '.eslintignore': 'vscode-icons:file-type-eslint',
  '.gitignore': 'vscode-icons:file-type-git',
  'yarn.lock': 'vscode-icons:file-type-yarn',
  '.env': 'vscode-icons:file-type-dotenv',
  '.env.example': 'vscode-icons:file-type-dotenv',
  '.vscode/settings.json': 'vscode-icons:file-type-vscode',
  '.nuxtrc': 'vscode-icons:file-type-nuxt',
  '.nuxtignore': 'vscode-icons:file-type-nuxt',
  'nuxt.config.ts': 'vscode-icons:file-type-nuxt',
  'nuxt.schema.ts': 'vscode-icons:file-type-nuxt',
  'tailwind.config.js': 'vscode-icons:file-type-tailwind',
  'tailwind.config.ts': 'vscode-icons:file-type-tailwind',
  ts: 'vscode-icons:file-type-typescript',
  tsx: 'vscode-icons:file-type-typescript',
  mjs: 'vscode-icons:file-type-js',
  cjs: 'vscode-icons:file-type-js',
  js: 'vscode-icons:file-type-js',
  jsx: 'vscode-icons:file-type-js',
  md: 'vscode-icons:file-type-markdown',
  py: 'vscode-icons:file-type-python',
  ico: 'vscode-icons:file-type-favicon',
  npm: 'vscode-icons:file-type-npm',
  pnpm: 'vscode-icons:file-type-pnpm',
  npx: 'vscode-icons:file-type-npm',
  yarn: 'vscode-icons:file-type-yarn',
  bun: 'vscode-icons:file-type-bun',
  deno: 'vscode-icons:file-type-deno',
  yml: 'vscode-icons:file-type-yaml',
  terminal: 'i-heroicons-command-line',
}

const { ui } = useUI('content.prose.code.icon', undefined, config, undefined, true)

const icon = computed(() => {
  if (props.icon) {
    return props.icon
  }

  const fullName = (props.filename || '').split(' ')[0] || ''
  const filename = fullName.split('/').pop() || ''

  if (ui.value[filename]) {
    return ui.value[filename]
  }

  if (filename.includes('.config') || /\w+rc/.test(filename)) {
    return ui.value['.config']
  }

  // if (fullName.includes('plugin')) {
  //   return ui.value['.plugin']
  // }

  const extName = filename.split('.').pop()
  if (ui.value[extName]) {
    return ui.value[extName]
  }
  return ''
})
</script>

<template>
  <UIcon v-if="icon" :name="icon.split(' ').pop()" dynamic />
</template>
