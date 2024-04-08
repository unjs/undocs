---
icon: bi:stars
---

# Content Transformation

> Discover ways that undocs transforms content to make it more easier to just write documentation.

<!-- automd:file src="../.partials/warn.md" -->

> [!IMPORTANT]
> Undocs is currently intended for UnJS docs only and is not fully customizable yet. <br>
> Contributions are more than welcome but please consider that this project is not ready yet to be used. <br>
> Make sure to use [Bun](https://bun.sh/) and [WSL](https://learn.microsoft.com/en-us/windows/wsl/install) for Windows.
> We don't guarantee stability yet and it is expected that it doesn't work time to time.

<!-- /automd -->

## Auto Code Groups

If you have code blocks right after each other, they will be grouped together using [`code-group`](https://ui.nuxt.com/pro/prose/code-group).

````md
    ```ts [nuxt.config.ts]
    export default defineNuxtConfig({
      modules: [],
    })
    ```

    ```ts [server/api/hello.get.ts]
    export default defineEventHandler(() => {
      return {
        hello: 'world'
      }
    })
    ```

    ```vue [app.vue]
    <template>
      <div>
      <h1>Welcome to the homepage</h1>
      </div>
    </template>
    ```
````

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  modules: [],
})
```

```ts [server/api/hello.get.ts]
export default defineEventHandler(() => {
  return {
    hello: 'world',
  }
})
```

```vue [app.vue]
<template>
  <div>
    <h1>Welcome to the homepage</h1>
  </div>
</template>
```

## Steps

Generate steps by useing standard markdown numbered lists!

> [!IMPORTANT]
> In order to generate this component, you need to have content inside at least one of the lists. The list can't be a child of another component & also any content within a Mardown list will need at least 2 tabs to be considered as a child of the list.

```md
1. Install Package

   ::note
   Please note that steps only work with numbered lists and is not within children.
   ::

   :pm-install{name="undocs"}

2. Run development server

   :pm-run{script="undocs"}

3. Done ✅
```

1. Install Package

   ::note
   Please note that steps only work with numbered lists and is not within children.
   ::

   :pm-install{name="undocs"}

2. Run development server

   :pm-run{script="undocs"}

3. Done ✅

> [!TIP]
> Do you have an idea for a new content transformation, feel free to [open an issue](https://github.com/unjs/undocs/issues/new?assignees=&labels=pending+triage&projects=&template=feature-request.yml)!
