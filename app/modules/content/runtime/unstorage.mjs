import { defineDriver } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import { transform, loadConfig } from 'automd'

const getDocsConfig = () => globalThis.__undocs__?.docsConfig || {}

export default (driverOpts) => {
  const _fs = fsDriver({
    base: driverOpts.base,
  })

  let automdConfig

  return defineDriver({
    ..._fs,
    name: 'content',
    async getItem(key) {
      const docsConfig = getDocsConfig()

      const val = await _fs.getItem(key)

      // Landing
      if (!val && key === 'index.json') {
        return await import('./landing.mjs').then(({ genLanding }) => genLanding(docsConfig))
      }
      if (!val && key === 'index.json$') {
        return { mtime: new Date() }
      }

      // Automd transform
      if (docsConfig.automd) {
        if (key.endsWith('.md') && typeof val === 'string') {
          if (!automdConfig) {
            automdConfig = await loadConfig(docsConfig.dir, docsConfig.automd)
          }
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
      const docsConfig = getDocsConfig()

      const keys = await _fs.getKeys(prefix)

      // Landing
      if (docsConfig.landing !== false && !keys.some((key) => /^index\.\w+$/.test(key))) {
        keys.push('index.json')
      }

      return keys
    },
  })
}
