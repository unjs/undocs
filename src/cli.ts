#!/usr/bin/env node
import { defineCommand, runMain } from 'citty'
import { setupDocs } from './setup'

const dev = defineCommand({
  meta: {
    name: 'dev',
    description: 'Start docs server in development mode',
  },
  args: {
    dir: {
      type: 'positional',
      description: 'Docs directory',
      required: true,
      default: '.',
    },
  },
  async setup({ args }) {
    const { dir, overrides } = await setupDocs(args.dir)
    process.chdir(dir)
    await import('nuxi').then((nuxi) => nuxi.runCommand('dev', [dir, '--no-fork', '--port', '4000'], { overrides }))
  },
})

const build = defineCommand({
  meta: {
    name: 'build',
    description: 'Build docs for production',
  },
  args: {
    dir: {
      type: 'positional',
      description: 'Docs directory',
      required: true,
      default: '.',
    },
  },
  async setup({ args }) {
    const { dir, overrides } = await setupDocs(args.dir)
    process.chdir(dir)
    await import('nuxi').then((nuxi) => nuxi.runCommand('build', [dir], { overrides }))
  },
})

const main = defineCommand({
  meta: {
    name: 'unjs-docs',
    description: 'UnJS Docs Builder',
  },
  subCommands: {
    dev,
    build,
  },
})

runMain(main)
