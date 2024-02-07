#!/usr/bin/env node
import jiti from 'jiti'

jiti(import.meta.url, { esmResolve: true })('../layers/unjs/cli/main.ts')
