#!/usr/bin/env node
import { defineCommand, runMain } from 'citty'
import { setupDocs, type SetupDocsOptions } from './setup'

export interface DocsCLIOptions {
  name?: string
  description?: string
  setup?: SetupDocsOptions
}

export function createCLI(opts: DocsCLIOptions = {}) {
  const sharedArgs = {
    dir: {
      type: 'positional',
      description: 'Docs directory',
      required: true,
      default: '.',
    },
  } as const

  const dev = defineCommand({
    meta: {
      name: 'dev',
      description: 'Start docs in development mode',
    },
    args: { ...sharedArgs },
    async setup({ args }) {
      const { appDir, nuxtConfig } = await setupDocs(args.dir, opts.setup)
      process.chdir(appDir)
      await import('nuxi').then((nuxi) =>
        nuxi.runCommand('dev', [appDir, '--no-fork', '--port', '4000'], { overrides: nuxtConfig }),
      )
    },
  })

  const build = defineCommand({
    meta: {
      name: 'build',
      description: 'Build static docs for production',
    },
    args: { ...sharedArgs },
    async setup({ args }) {
      const { appDir, nuxtConfig } = await setupDocs(args.dir, opts.setup)
      process.chdir(appDir)
      await import('nuxi').then((nuxi) => nuxi.runCommand('generate', [appDir], { overrides: nuxtConfig }))
    },
  })

  const main = defineCommand({
    meta: {
      name: opts.name,
      description: opts.description,
    },
    subCommands: {
      dev,
      build,
    },
  })

  return {
    runMain: () => runMain(main),
  }
}
