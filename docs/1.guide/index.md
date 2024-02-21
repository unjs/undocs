# Getting Started

> [!IMPORTANT]
> This is an internal tool meant for UnJS docs tooling and not reusable at the moment.
> These docs are for demonstration purposes only, do not rely on them or this tool!

## Overview

UnJS Docs is a minimal Documentation Theme and CLI for shared usage across UnJS projects.

It is made with [Nuxt](https://nuxt.com/), [Nuxt Content](https://content.nuxt.com), [Nuxt SEO](https://nuxtseo.com) and [Nuxt UI Pro](https://ui.nuxt.com/pro) with a zero config and elegant CLI wrapper.

## Quick Start

Create `docs/` project with starter template:

:pm-x{command="giget gh:unjs/undocs/template docs --install"}

Go to the docs dir `cd docs/`

Start development server:

:pm-run{script="dev"}

Build for production:

:pm-run{script="build"}

## Configuration

```json [docs.json]
{
  "$schema": "https://raw.githubusercontent.com/unjs/docs/main/schema/config.json",
  "name": "packageName",
  "description": "packageDescription",
  "shortDescription": "packageShortDescription",
  "github": "unjs/packageName",
  "redirects": {},
  "landing": {
    "contributors": true,
    "heroCode": "",
    "heroFeatures": [],
    "heroLinks": {},
    "features": []
  }
}
```

## Components

:read-more{to="/components"}

<!-- automd:with-automd -->

<!-- /automd -->
