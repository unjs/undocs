import { defineDriver } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'

export default (opts) => {
  const _fs = fsDriver({
    base: opts.docsConfig.dir,
   })

  return defineDriver({
    ..._fs,
    name: 'content',
    async getItem(key) {
      const val = await _fs.getItem(key)
      if (!val && key === 'index.json') {
        return await import('./landing.mjs').then(({ genLanding }) => genLanding(opts.docsConfig))
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


