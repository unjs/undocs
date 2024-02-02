import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { defineNuxtModule, useLogger } from 'nuxt/kit'
import { createTar, parseTar } from 'nanotar'
import { hash, objectHash, murmurHash } from 'ohash'
import { detectPackageManager } from 'nypm'
import { readPackageJSON, findNearestFile } from 'pkg-types'

// === experimental build cache module to save lives! ===

export default defineNuxtModule({
  setup(_, nuxt) {
    if (nuxt.options._prepare || nuxt.options.dev) {
      return
    }
    const logger = useLogger('nuxt-build-cache')

    // Setup hooks
    nuxt.hook('build:done', () => {
      collectBuildCache().catch(logger.error)
    })
    nuxt.hook('build:before', async () => {
      const restored = await restoreBuildCache()
      if (!restored) {
        return
      }
      nuxt.options.builder = {
        bundle() {
          logger.log('(skipping build)')
          return Promise.resolve()
        },
      }
    })

    // --- collect hashes from project ---
    type HashSource = { name: string; data: string | number }
    type Hashes = { hash: string; sources: HashSource[] }
    let _cachedHashes: ReturnType<typeof _getHashes> | undefined
    function getHashes() {
      if (!_cachedHashes) {
        _cachedHashes = _getHashes()
      }
      return _cachedHashes
    }
    async function _getHashes(): Promise<Hashes> {
      const sources: HashSource[] = []

      // Layers
      let layerCtr = 0
      for (const layer of nuxt.options._layers) {
        if (layer.cwd.includes('node_modules')) {
          continue
        }
        const layerName = `layer#${layerCtr++}`
        sources.push({
          name: `${layerName}:config`,
          data: objectHash(layer.config),
        })
        // TODO: Include source files (not essential for docs because .docs/ layer has none usually)
      }

      // package.json and lock file
      const pm = await detectPackageManager(nuxt.options.rootDir).catch(() => undefined)
      if (pm) {
        const lockfilePath = await findNearestFile(pm.lockFile, { startingFrom: nuxt.options.rootDir }).catch(
          () => undefined,
        )
        if (lockfilePath) {
          sources.push({
            name: pm.lockFile,
            data: 'murmurHash:' + murmurHash(await readFile(lockfilePath)),
          })
        }
      }
      const pkgJSON = await readPackageJSON(nuxt.options.rootDir).catch(() => undefined)
      if (pkgJSON) {
        sources.push({
          name: 'package.json',
          data: JSON.stringify(pkgJSON),
        })
      }

      return {
        hash: hash(sources),
        sources,
      }
    }

    // -- utility to get current cache dir
    async function getCacheStore() {
      const hashes = await getHashes()
      const cacheDir = join(
        nuxt.options.workspaceDir,
        '.next/cache', // https://developers.cloudflare.com/pages/configuration/build-caching/#frameworks -_-
        // 'node_modules/.cache/nuxt-build-cache',
        hashes.hash,
      )
      const cacheFile = join(cacheDir, 'nuxt.tar')
      return {
        hashes,
        cacheDir,
        cacheFile,
      }
    }

    // -- collect build cache --
    async function collectBuildCache() {
      const { cacheDir, cacheFile, hashes } = await getCacheStore()
      await mkdir(cacheDir, { recursive: true })
      await writeFile(join(cacheDir, 'hashes.json'), JSON.stringify(hashes, undefined, 2))

      const start = Date.now()
      logger.start(`Collecting nuxt build cache from \`${nuxt.options.buildDir}\`...`)
      const fileEntries = await readFilesRecursive(nuxt.options.buildDir)
      const tarData = await createTar(fileEntries)
      await writeFile(cacheFile, tarData)
      logger.success(`Nuxt build cache collected in \`${Date.now() - start}ms\` to \`${cacheDir}\``)
    }

    // -- restore build cache --
    async function restoreBuildCache(): Promise<boolean> {
      const { cacheFile, cacheDir } = await getCacheStore()
      if (!existsSync(cacheFile)) {
        logger.info(`No build cache found in \`${cacheFile}\``)
        return false
      }
      const start = Date.now()
      logger.start(`Restoring nuxt from build cache from \`${cacheDir}\`...`)
      const files = parseTar(await readFile(cacheFile))
      for (const file of files) {
        const filePath = join(nuxt.options.buildDir, file.name)
        await mkdir(join(filePath, '..'), { recursive: true })
        await writeFile(filePath, file.data, { mode: file.attrs?.mode })
      }
      logger.success(`Nuxt build cache restored in \`${Date.now() - start}ms\` into \`${nuxt.options.buildDir}\``)
      return true
    }
  },
})

async function readFilesRecursive(dir: string) {
  const files = await readdir(dir, { recursive: true, withFileTypes: true })

  const fileEntries = await Promise.all(
    files.map(async (file) => {
      if (!file.isFile()) {
        return
      }
      const data = await readFile(join(dir, file.name))
      return {
        name: file.name,
        data,
      }
    }),
  )

  return fileEntries.filter(Boolean)
}
