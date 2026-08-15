<script setup lang="ts">
// The `/` route, which is one of two pages depending on the docs' shape:
// the marketing landing (`landing.vue`), or the docs-root `index.md` rendered
// as an ordinary docs page (`[...slug].vue`, whose `queryPage(route.path)`
// resolves `/` to the root page). `useLanding` explains the choice; `AppLayout`
// reads the same flag to give the second case the docs layout and its sidebar.
//
// The branch is a `v-if` over two statically-imported pages rather than a
// component picked in `router.ts`, because the decision needs the content tree,
// which is only fetched once `app.vue`'s setup has run — after the router has
// already matched `/` and resolved its component. Both branches have async
// `<script setup>`; they resolve inside `AppPage`'s `<Suspense>` exactly as a
// directly-routed page would, and only the rendered branch's setup runs.
import { useLanding } from "@app/composables/useLanding.ts";
import DocsPage from "@app/pages/[...slug].vue";
import LandingPage from "@app/pages/landing.vue";

const landing = useLanding();
</script>

<template>
  <LandingPage v-if="landing" />
  <DocsPage v-else />
</template>
