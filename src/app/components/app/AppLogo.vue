<script setup lang="ts">
import { useAppConfig } from "@app/composables/useAppConfig.ts";

// The project's mark. When it is the project's OWN `icon.svg` (detected by
// `generateAppConfig`, read at build time by the `virtual:undocs/app-config`
// plugin) the markup is INLINED rather than pointed at through an `<img src>`:
// inline SVG costs no request, carries none of a data URI's percent-encoding
// overhead, and — unlike an `<img>` — inherits `currentColor` and takes CSS the
// caller puts on it. A `logo` the author WROTE is a URL (possibly remote,
// possibly a PNG), so it stays an `<img>`. Callers style either branch through
// the fall-through `class`.
//
// `v-html` is safe here for the same reason the `.docs/` theme layer is: the
// file is the docs project's own, and it is read at BUILD time — it is no more
// foreign than the components that project ships.
const appConfig = useAppConfig();
</script>

<template>
  <!-- The inlined document keeps its own `width`/`height` attributes, so the
       caller's sizing has to reach the child element to beat them. -->
  <span
    v-if="appConfig.docs.logoSvg"
    role="img"
    :aria-label="`${appConfig.site.name} logo`"
    class="inline-block [&>svg]:h-full [&>svg]:w-full"
    v-html="appConfig.docs.logoSvg"
  />
  <img
    v-else-if="appConfig.docs.logo"
    :src="appConfig.docs.logo"
    :alt="`${appConfig.site.name} logo`"
  />
</template>
