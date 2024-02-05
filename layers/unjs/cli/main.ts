import { fileURLToPath } from 'node:url'
import { createCLI } from '../../core/cli/cli'

const appDir = fileURLToPath(new URL('../app', import.meta.url))

const cli = createCLI({
  name: 'undocs',
  description: 'UnJS Docs Tool',
  setup: {
    extends: [appDir],
    defaults: {
      github: 'unjs',
      themeColor: '#ECDC5A',
    },
  },
})

cli.runMain()
