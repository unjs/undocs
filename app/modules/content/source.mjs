import { defineDriver } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import { transform, loadConfig } from 'automd'

export default (opts) => {
  const _fs = fsDriver({
    base: opts.docsConfig.dir,
  })

  let automdConfig

  return defineDriver({
    ..._fs,
    name: 'content',
    async getItem(key) {
      const val = await _fs.getItem(key)

      // Landing
      if (opts.docsConfig.automd) {
        if (!val && key === 'index.json') {
          return await import('./landing.mjs').then(({ genLanding }) => genLanding(opts.docsConfig))
        }
        if (!val && key === 'index.json$') {
          return { mtime: new Date() }
        }
      }

      // Automd transform
      if (opts.docsConfig.automd) {
        if (key.endsWith('.md') && typeof val === 'string') {
          if (!automdConfig) { automdConfig = await loadConfig(opts.docsConfig.dir, opts.docsConfig.automd) }
          const res = await transform(val, automdConfig)
          if (res.hasChanged) {
            _fs.setItem(key, res.contents).catch(console.error)
          }
          return res.contents
        } else if (key.endsWith('.md$')) {
          return { mtime: new Date() }
        }
      }

      return val
    },
    async getKeys(prefix) {
      const keys = await _fs.getKeys(prefix)

      // Landing
      if (opts.docsConfig.landing !== false && !keys.some((key) => /^index\.\w+$/.test(key))) {
        keys.push('index.json')
      }

      return keys
    },
  })
}
