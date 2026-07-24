# UnDocs

Minimal documentation theme and CLI for shared usage across UnJS/H3/Nitro projects.

Write your docs as Markdown, drop in a single config file, and get a fast,
elegant, zero-config documentation site — dev server, production build, search,
and `llms.txt` included.

## Quick Start

A docs project is three files. Create them in a `docs/` folder:

**1. `docs/package.json`** — pulls in the CLI and wires up two scripts:

```json
{
  "name": "docs",
  "private": true,
  "scripts": {
    "dev": "undocs dev",
    "build": "undocs build"
  },
  "devDependencies": {
    "undocs": "latest"
  }
}
```

**2. `docs/.config/docs.yaml`** — your site config:

```yaml
# yaml-language-server: $schema=https://unpkg.com/undocs/schema/config.json
name: "packageName"
shortDescription: "One-line summary."
description: "A longer description of your project."
github: "unjs/packageName"
```

**3. `docs/1.guide/1.index.md`** — your first page:

```md
# Getting Started

Welcome to the docs!
```

Then install and start the dev server on [localhost:3000](http://localhost:3000):

```sh
cd docs
npm install
npm run dev
```

Build a static production bundle with `npm run build`.

### Adding pages

Every Markdown file becomes a page. Numeric prefixes (`1.`, `2.`) control the
order in the sidebar and are stripped from the URL, so `1.guide/1.index.md`
is served at `/guide`. Add folders and files to grow the navigation — no routing
setup required:

```
docs/
├─ .config/
│  └─ docs.yaml
├─ 1.guide/
│  ├─ 1.index.md       → /guide
│  └─ 2.usage.md       → /guide/usage
└─ 2.config/
   └─ 1.index.md       → /config
```

See the [configuration reference](https://undocs.pages.dev/config) for the full
list of options (landing page, banner, socials, sponsors, `llms.txt`, and more).

## Stack

Undocs is currently powered by [Nitro](https://nitro.build), [Vite](https://vite.dev), [md4x](https://github.com/unjs/md4x), [shiki](https://github.com/shikijs/shiki), [Unhead](http://unhead.unjs.io/) and [Reka UI](https://reka-ui.com/).

> UnDocs was originally based on [Nuxt](https://nuxt.com/), [Nuxt UI](https://ui.nuxt.com/), [Nuxt Content](https://content.nuxt.com/) ([Comark](https://comark.dev/)), [Vue Router](https://router.vuejs.org/), and other Nuxt ecosystem modules such as [nuxt-llms](https://github.com/nuxt-content/nuxt-llms) and [nuxt-icon](https://github.com/nuxt/icon) which inspired the new generation of undocs.

## License

Published under the [MIT](https://github.com/unjs/undocs/blob/main/LICENSE) license.
