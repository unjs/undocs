import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
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
          try {
            if (!automdConfig) {
              automdConfig = await loadConfig(docsConfig.dir, docsConfig.automd)
            }
            const url = pathToFileURL(join(driverOpts.base, key.replace(/:/g, '/')))
            const res = await transform(val, automdConfig, url)
            if (res.hasChanged && !res.hasIssues) {
              _fs.setItem(key, res.contents).catch(console.error)
            }
            if (res.hasIssues) {
              console.warn(
                `[undocs] [automd] Issues for updating \`${key}\`:`,
                res.updates
                  .flatMap((u) => u.result.issues)
                  .map((i) => `\n  - ${i}`)
                  .join('\n'),
              )
              return val // Fallback to original content
            }
            return res.contents
          } catch (error) {
            console.error(`[undocs] [automd] Error transforming \`${key}\`:`, error)
            return val // Fallback to original content
          }
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
