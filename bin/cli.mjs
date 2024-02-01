#!/usr/bin/env bun
import jiti from 'jiti'

jiti(import.meta.url, { esmResolve: true })('../layers/unjs/cli/main.ts')
