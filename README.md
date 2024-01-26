# UnJS Docs

Minimal Documentation Theme and CLI for shared usage across UnJS projects.

Made with [Nuxt](https://nuxt.com/), [Nuxt Content](https://content.nuxt.com), [Nuxt SEO](https://nuxtseo.com) and [Nuxt UI Pro](https://ui.nuxt.com/pro).

## Usage

> [!NOTE]
> This project is under development and usage might change.

1. Install `unjs-docs` as a dev dependency
2. Create `docs.config.ts` and set config

```ts
import { defineDocsConfig } from 'unjs-docs/config'

export default defineDocsConfig({
  name: 'packageName',
  description: 'packageDescription',
  github: 'unjs/packageName',
  // themeColor: '#f98007',
})
```

3. Create `content/index.yml` for the homepage and `content/**.md` for the docs.

> [!TIP]
> You can set a custom subtitle and meta description in the front matter of each markdown file with the key `description`. Otherwise, the first paragraph will be used from the page to be used as a subtitle on the page and in the meta description.

4. Add an `icon.svg` file in the `public` folder.

> [!TIP]
> You can find the icon from your package in the [design kit of the website](https://unjs.io/design-kit#package-logos).

5. Use `npx unjs-docs dev` to start in development mode and `npx unjs-docs build` to build for production!

Check out [playground](./playground/) as an example.

## License

[MIT](./LICENSE)
