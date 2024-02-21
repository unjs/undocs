#!/usr/bin/env node

import { fileURLToPath } from 'node:url'
import { createCLI } from './cli.mjs'


const cli = createCLI({
  name: 'undocs',
  description: 'UnJS Docs Tool',
  setup: {
    defaults: {
      github: 'unjs',
      themeColor: '#ECDC5A',
    },
  },
})

cli.runMain()
