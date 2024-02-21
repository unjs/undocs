import { defineCommand, runMain } from 'citty'
import { setupDocs } from './setup.mjs'

export function createCLI(opts) {
  const sharedArgs = {
    dir: {
      type: 'positional',
      description: 'Docs directory',
      required: true,
      default: '.',
    },
  }

  const dev = defineCommand({
    meta: {
      name: 'dev',
      description: 'Start docs in development mode',
    },
    args: { ...sharedArgs },
    async setup({ args }) {
      const { appDir, nuxtConfig } = await setupDocs(args.dir, { ...opts.setup, dev: true })
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
