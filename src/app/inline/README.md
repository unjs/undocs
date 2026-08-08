# `src/app/inline/` — blocking `<head>` programs

Code that must run **before the app bundle**, inlined verbatim into every HTML
response by `entry-server.ts`.

Each program is a pair:

| File        | Role                                                      |
| ----------- | --------------------------------------------------------- |
| `<name>.ts` | the source — edited, reviewed, typechecked, linted        |
| `<name>.js` | the compiled artifact — **generated**, committed, shipped |

```bash
pnpm build:inline           # regenerate the .js files
pnpm build:inline --check   # verify they are current (also a vitest drift guard)
```

`scripts/build-inline.mjs` bundles each `.ts` with **rolldown** (`format: "iife"`,
`minify: true`). `entry-server.ts` pulls the artifact in as text (`?raw`) and
wraps it in a `<script>` tag.

**The `.js` files are generated — never edit them by hand.** They deliberately
carry no banner saying so: the text is inlined into every HTML response, so a
comment would be bytes paid per page view. `pnpm build:inline` overwrites them
and the drift test fails on any hand edit, so a stray change cannot survive.

## Why compile instead of writing the JS by hand

These programs used to be hand-minified template literals inside
`entry-server.ts`. As real `.ts` files they get typechecking (`document`, CSSOM
and `location` are typed, so a wrong property name fails `pnpm typecheck`),
`oxlint`/`oxfmt`, ordinary imports of shared constants (`../embed-theme`), and
readable diffs. The compiler produces the compact form, and escaping — the
`\\(` a template literal needed inside a regex — stops being a hazard.

## Why the output is committed

The artifact is what ships, so it belongs in review: a diff shows the exact bytes
added to every HTML response. It also keeps `vite build` free of a codegen step —
nothing has to run before the app builds. `test/app/inline-build.test.ts` runs the
real build and fails if a committed artifact drifts from its source.

## Rules for a program here

- **Self-contained.** Only import plain constants; everything is inlined into the
  bundle and ships on every page. Nothing that pulls in a runtime.
- **Complete statement, no globals.** `iife` output, so it leaks no bindings.
- **Cheap.** It blocks the first paint. Bail out early on the common path.
- **No `</script>` in any string** — it would terminate the tag it lives in.
