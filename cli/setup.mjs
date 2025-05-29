import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'
import { loadConfig, watchConfig } from 'c12'

const appDir = fileURLToPath(new URL('../app', import.meta.url))

const pkgDir = fileURLToPath(new URL('..', import.meta.url))

export async function setupDocs(docsDir, opts = {}) {
  // Load config
  const { unwatch, config: docsconfig } = await (opts.watch ? watchConfig : loadConfig)({
    name: 'docs',
    cwd: docsDir,
    defaults: {
      url: inferSiteURL(),
      ...opts.defaults,
    },
    ...opts.watch,
  })

  // Normalize dir
  docsconfig.dir = docsDir = resolve(docsconfig.dir || docsDir)

  globalThis.__DOCS_CWD__ = docsconfig.dir

  // URL is required for production build (SEO)
  if (!docsconfig.url && !opts.dev) {
    throw new Error('`url` config is required for production build!')
  }

  // Guess branch
  docsconfig.branch = docsconfig.branch || getGitBranch() || 'main'

  // Convert markdown to HTML for landing items
  if (docsconfig.landing?.features) {
    const md4w = await import('md4w')
    await md4w.init()
    for (const item of docsconfig.landing.features) {
      if (item.description) {
        item.description = md4w.mdToHtml(item.description)
      }
    }
  }

  // Normalize and format hero code
  if (docsconfig.landing?.heroCode) {
    if (typeof docsconfig.landing.heroCode === 'string') {
      docsconfig.landing.heroCode = {
        content: docsconfig.landing.heroCode,
      }
    }
    const shiki = await import('shiki')
    docsconfig.landing.heroCode.contentHighlighted = (
      await shiki.codeToHtml(docsconfig.landing.heroCode.content, {
        lang: docsconfig.landing.heroCode.lang || 'sh',
        defaultColor: 'dark',
        themes: {
          default: 'github-dark',
          dark: 'github-dark',
          light: 'github-light',
        },
      })
    )
      .replace(/background-color:#[0-9a-fA-F]{6};/g, '')
      .replaceAll(`<span class="line"></span>`, '')
  }

  // Module to fix layers (force add .docs as first)
  const docsSrcDir = resolve(docsDir, '.docs')
  const fixLayers = (_, nuxt) => {
    nuxt.options._layers.unshift({
      cwd: docsSrcDir,
      config: {
        rootDir: docsSrcDir,
        srcDir: docsSrcDir,
      },
    })
  }

  // Prepare loadNuxt overrides
  const nuxtConfig = {
    compatibilityDate: '2024-08-16',
    rootDir: docsSrcDir,
    srcDir: docsSrcDir,
    extends: [...(opts.extends || []), appDir],
    modulesDir: [resolve(pkgDir, 'node_modules'), resolve(docsDir, 'node_modules')],
    modules: ['@nuxt/ui-pro', fixLayers, docsconfig.buildCache ? 'nuxt-build-cache' : undefined].filter(Boolean),
    // @ts-ignore
    docs: docsconfig,
    // @ts-ignore
    site: {
      name: docsconfig.name || '',
      description: docsconfig.description || '',
      url: docsconfig.url,
    },
    appConfig: {
      site: {
        name: docsconfig.name || '',
        description: docsconfig.description || '',
        url: docsconfig.url,
      },
      docs: docsconfig,
    },
    nitro: {
      static: true,
      publicAssets: [{ baseURL: '/', dir: resolve(docsDir, '.docs/public'), maxAge: 0 }],
      serverAssets: [
        {
          baseName: 'public',
          dir: resolve(docsDir, '.docs/public'),
        },
      ],
    },
    routeRules: {
      ...Object.fromEntries(Object.entries(docsconfig.redirects || {}).map(([from, to]) => [from, { redirect: to }])),
    },
  }

  return {
    docsDir,
    appDir,
    nuxtConfig,
    unwatch,
  }
}

function inferSiteURL() {
  // https://github.com/unjs/std-env/issues/59
  return (
    process.env.NUXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL && `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`) || // Vercel
    process.env.URL || // Netlify
    process.env.CI_PAGES_URL || // Gitlab Pages
    process.env.CF_PAGES_URL // Cloudflare Pages
  )
}

function getGitBranch() {
  const envName =
    process.env.CF_PAGES_BRANCH ||
    process.env.CI_COMMIT_BRANCH ||
    process.env.VERCEL_BRANCH_URL ||
    process.env.BRANCH ||
    process.env.GITHUB_REF_NAME
  if (envName && envName !== 'HEAD') {
    return envName
  }
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
    if (branch && branch !== 'HEAD') {
      return branch
    }
  } catch {
    // Ignore
  }
}
