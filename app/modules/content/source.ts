import { defineDriver } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'

import type { DocsConfig } from '../../../config'

export interface ContentSourceOptions {
  docsConfig: DocsConfig
}

export default (opts: ContentSourceOptions) => {
  const _fs = fsDriver({
    base: opts.docsConfig.dir + '/content',
   })

  return defineDriver({
    ..._fs,
    name: 'content',
    async getItem(key: string) {
      const val = await _fs.getItem(key)
      if (!val && key === 'index.json') {
        return await import('./landing').then(({ genLanding }) => genLanding(opts.docsConfig))
      }
      if (!val && key === 'index.json$')  {
        return { mtime: new Date() }
      }
      return val
    },
    async getKeys(prefix) {
      const keys = await _fs.getKeys(prefix)
      if (!keys.some(key => /^index\.\w+$/.test(key))) {
        keys.push('index.json')
      }
      return keys
    },
  })
}


