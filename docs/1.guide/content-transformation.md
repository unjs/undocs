---
icon: bi:stars
---

# Content Transformation

> Discover ways that undocs transforms content to make it more easier to just write documentation.

## Auto Code Groups

If you have code blocks right after each other, they will be grouped together using [`code-group`](https://ui.nuxt.com/pro/prose/code-group).

```md
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
```

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

## Twoslash Code Blocks

[nuxt-content-twoslash](https://github.com/antfu/nuxt-content-twoslash#nuxt-content-twoslash) is only enabled for production builds to enhance development experience.

```md
    ```ts twoslash [index.ts]
    console.log("Hello, World")
    ```

    ```ts twoslash [nuxt.config.ts]
    export default defineNuxtConfig({
      modules: [],
      nitro: {
        static: true
      }
    })
    ```

    ```vue twoslash [index.vue]
    <script lang="ts" setup>
    import { ref, onMounted } from 'vue'

    const name = ref("World")
    //    ^?


    onMounted(() => {
      console.log("Hello, World")
    })
    </script>

    <template>
      <div>Hello, {{ name }}</div>
    </template>
    ```
```

```ts twoslash [index.ts]
console.log("Hello, World")
```

```ts twoslash [nuxt.config.ts]
export default defineNuxtConfig({
  modules: [],
  nitro: {
    static: true
  }
})
```

```vue twoslash [index.vue]
<script lang="ts" setup>
import { ref, onMounted } from 'vue'

const name = ref("World")
//    ^?


onMounted(() => {
  console.log("Hello, World")
})
</script>

<template>
  <div>Hello, {{ name }}</div>
</template>
```

> [!TIP]
> Do you have an idea for a new content transformation, feel free to [open an issue](https://github.com/unjs/undocs/issues/new?assignees=&labels=pending+triage&projects=&template=feature-request.yml)!
