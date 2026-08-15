---
icon: i-lucide-rocket
---

# Getting Started

> This is your new documentation site. Everything you see is Markdown — edit the
> files in this directory and the page updates instantly.

## Run it

Start the development server:

:pm-run{script="dev"}

Build for production:

:pm-run{script="build"}

The build writes a self-contained server to `.output/`, which you can run
anywhere Node is available:

```sh
node .output/server/index.mjs
```

## Project structure

```
.
├── .config/
│   └── docs.yaml   # site configuration (optional)
├── index.md        # this page — served at `/`
├── another.md      # served at `/another`
└── package.json
```

There is nothing else to set up: every `.md` file in this directory becomes a
page, and the navigation, table of contents, search index and `llms.txt` are
derived from them.

## Add a page

Create a Markdown file. Its path becomes the route:

| File                  | Route               |
| --------------------- | ------------------- |
| `index.md`            | `/`                 |
| `another.md`          | `/another`          |
| `guide/index.md`      | `/guide`            |
| `guide/components.md` | `/guide/components` |

Directories become sections in the sidebar. To order pages and sections, prefix
them with a number — the prefix is stripped from the route:

```
1.guide/
  1.index.md      → /guide
  2.components.md → /guide/components
2.config/
  1.index.md      → /config
```

::tip
Give a directory its own title or icon by adding a `.navigation.yml` file next
to its pages. `navigation: false` in that file hides the whole section from the
sidebar while keeping its pages routable.
::

## Page metadata

The first `# heading` becomes the page title and the blockquote right after it
becomes the description — the two lines at the top of this page. Override them,
or add an icon, with frontmatter:

```md
---
icon: i-lucide-book-open
title: Custom title
description: Shown in search results, page meta tags and llms.txt.
navigation:
  title: Shorter sidebar label
---

# Getting Started

> The description used when no frontmatter one is given.
```

Set `navigation: false` to keep a page routable and searchable but out of the
sidebar.

## Configure the site

Site-wide options live in `.config/docs.yaml`:

```yaml
# yaml-language-server: $schema=https://unpkg.com/undocs/schema/config.json

name: "my-package"
description: "What this project does."
github: "unjs/my-package"
url: "https://my-package.unjs.io"
themeColor: "blue"
```

`name` and `description` are optional — they fall back to the closest
`package.json`. `themeColor` tints links, active navigation and icons; the rest
of the interface stays monochrome.

The schema comment at the top gives you completion and validation in editors
with the YAML language server. TypeScript (`.config/docs.ts`) and JSON work too.

::note
Docs that are a flat list of pages — like this template — use the root
`index.md` as the home page. Once you organise pages into sections, `/` becomes
a landing page with a hero instead. Force either one with `landing:` config or
`landing: false`.
::

## Beyond plain Markdown

GitHub-style alerts are rendered as callouts:

```md
> [!NOTE]
> Highlights information that users should take into account, even when skimming.
```

> [!NOTE]
> Highlights information that users should take into account, even when skimming.

Consecutive code blocks are grouped into tabs, using the bracketed title as the
label:

````md
```json [package.json]
{ "name": "docs" }
```

```sh [terminal]
npm run dev
```
````

Inline components use [MDC](https://content.nuxt.com/docs/files/markdown)
syntax — a leading `:` for inline, `::` for blocks:

```mdc
:pm-install{name="undocs"}

:read-more{to="/another"}

::warning
Critical content demanding immediate user attention.
::
```

:pm-install{name="undocs"}

:read-more{to="/another"}

## Next steps

- Replace this page with your own introduction.
- Try the search (`⌘K` / `Ctrl K`) — it indexes every page as you write.
- Check `/llms.txt` and `/llms-full.txt`, generated from your content.

:read-more{to="https://undocs.pages.dev" title="undocs documentation"}
