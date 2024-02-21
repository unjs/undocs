import { defineCommand, runMain } from 'citty'
import consola from 'consola'
// import { relative } from "pathe"
import { getContext } from 'unctx'
import { setupDocs } from './setup.mjs'

const HMRKeys = new Set(['description', 'shortDescription', 'landing'])

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
      // const cwd = process.cwd()
      const logger = consola.withTag('undocs')
      const { tryUse: tryUseNuxt } = getContext('nuxt')

      const { appDir, nuxtConfig, unwatch } = await setupDocs(args.dir, {
        ...opts.setup,
        dev: true,
        watch: {
          // onWatch: (event) => {
          // logger.info(`Config file ${event.type} \`${relative(cwd, event.path)}\``)
          // },
          acceptHMR({ getDiff }) {
            const diff = getDiff().filter((entry) => entry.key !== 'dir')
            if (diff.length === 0) {
              return true
            }
          },
          onUpdate({ getDiff, newConfig: { config } }) {
            const diff = getDiff().filter((entry) => entry.key !== 'dir')
            logger.info('Config updated:\n' + diff.map((i) => ' - ' + i.toJSON()).join('\n'))
            Object.assign(nuxtConfig.docs, config)
            if (diff.some((entry) => !HMRKeys.has(entry.key.split('.')[0]))) {
              logger.info('Full reloading...')
              tryUseNuxt()?.callHook('restart')
            } else {
              logger.info('Fast reloading...')
              tryUseNuxt()?.callHook('undocs:config', config)
            }
          },
        },
      })

      process.chdir(appDir)
      process.on('exit', () => unwatch())

      const { runCommand } = await import('nuxi')
      await runCommand('dev', [appDir, '--no-fork', '--port', process.env.PORT || '4000'], { overrides: nuxtConfig })
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

      const { runCommand } = await import('nuxi')
      await runCommand('generate', [appDir], { overrides: nuxtConfig })
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
