# UnJS Docs

Minimal Documentation Theme and CLI for shared usage across UnJS projects.

Made with [Nuxt](https://nuxt.com/), [Nuxt Content](https://content.nuxt.com) and [Nuxt UI Pro](https://ui.nuxt.com/pro).

This is fully SEO friendly thanks to [Nuxt SEO](https://nuxtseo.com).

## Usage

> [!NOTE]
> This project is under development and usage might change.

1. Install `unjs-docs` as a dev dependency
2. Create `docs.config.ts` and set the name, description, github and themeColor.

```ts
import { defineDocsConfig } from 'unjs-docs/config'

export default defineDocsConfig({
  name: 'Docs Theme',
  description: 'Default documentation for UnJS package.',
  github: 'unjs/docs',
  themeColor: '#f98007',
})
```

> [!NOTE]
> Color can be a HEX or RGB value.

3. Create `content/index.yml` for the homepage and `content/**.md` for the docs.

> [!IMPORTANT]
> You **must** set a description in the front-matter of each markdown file.

4. Add a `favicon.svg` in the `public` folder.

> [!NOTE]
> You can find the icon from your package in the [design kit of the website](https://unjs.io/design-kit#package-logos).

5. Use `npx unjs-docs dev` to start in development mode and `npx unjs-docs build` to build for production!

Check out [playground](./playground/) as example.

## License

[MIT](./LICENSE)
