# UnJS Docs

Minimal Documentation Theme and CLI for shared usage across unjs projects.

Made with [Nuxt](https://nuxt.com/), [Nuxt Content](https://content.nuxt.com) and [Nuxt UI Pro](https://ui.nuxt.com/pro).

## Usage

> [!NOTE]
> This project is under development and usage might change.

1. Install `unjs-docs` as a dev dependency
2. Create `app.config.ts`:

```ts
export default {
  docs: {
    name: '...',
    description: '...',
    github: '.../...',
  },
}
```

3. Create `content/index.md` or `content/index.yml`

4. Use `npx unjs-docs dev` to start in development mode and `npx unjs-docs build` to build for production!

Check out [playground](./playground/) as example.

## License

[MIT](./LICENSE)
