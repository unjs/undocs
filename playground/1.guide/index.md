# Getting Started

Writing docs should be fun and this tool is exactly designed for this!

## Overview

UnJS Docs is a minimal Documentation Theme and CLI for shared usage across UnJS projects.

It is made with [Nuxt](https://nuxt.com/), [Nuxt Content](https://content.nuxt.com), [Nuxt SEO](https://nuxtseo.com) and [Nuxt UI Pro](https://ui.nuxt.com/pro) with a zero config and elegant CLI wrapper.

## Quick Start

Create `docs/` project with starter template:

```sh
npx giget@latest gh:unjs/docs/template docs
```

Go to the docs dir `cd docs/`

Install dependencies:

:packageManager{action="install" name="unjs-docs" auto}

::note
  "Auto" uses [`nypm`](https://github.com/unjs/nypm) - it automatically installs using the package manager based on your project.
::

Start development server:

```sh
npm run dev
```

Build for production:

```sh
npm run build
```

## Components

:read-more{to="/components"}
