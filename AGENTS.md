# AGENTS.md

`undocs` — the UnJS documentation generator. A standalone **Nitro v3 + Vite +
Vue** app that renders a docs site from a directory of Markdown. It ships as a
CLI (`undocs dev` / `undocs build`) that a docs project depends on; the docs
project supplies only Markdown + one config file.

NEVER write E2E tests. Ask for it to be tested manually.

## Orientation

- `src/app/**` is the CLIENT (browser + SSR render); `src/server/**` is NITRO
  (node-only). The line between them is HTTP, and it is an invariant (below).
- From-scratch router (`src/app/router.ts`) instead of vue-router. Our own UI
  primitives (`components/ui/primitives/`) instead of reka-ui. Tailwind v4
  themed with **Geist** (vercel.com/geist); every colour, type step and material
  comes from `assets/tokens.css`.
- `md4x` (Markdown → comark AST) and `rangi` (highlight, synchronous) are
  server-only.
- The CLI sets `UNDOCS_DIR` (default `.`, falling back to `./docs`). `pkgRoot`
  is resolved from `import.meta.url` and used as Vite's `root`/`configFile`, so
  an installed bin always loads OUR config, not the user's cwd.
- Two configs, merged once by `useAppConfig()`: `defu(userConfig, themeConfig)` —
  the docs project's `.config/docs.*` (loaded by c12, exposed to the client as
  the build-time virtual module `virtual:undocs/app-config`, generated once per
  build) wins; theme-only keys from `src/app/app.config.ts` survive. Shape lives
  in `schema/config.json` + `config.d.ts`.
- `src/app/webmcp/` — [WebMCP](https://webmachinelearning.github.io/webmcp/):
  registers docs tools (search/list/project-info/read/current/navigate) on
  `document.modelContext` for browser AI agents. `polyfill.ts` is the only part
  in the MAIN bundle: `main.ts` installs it after mount when the browser has no
  native `document.modelContext`, and `index.ts` + `tools/` stay a lazy chunk
  the polyfill does not fetch until an agent first LOOKS (a `getTools()` call,
  or a `toolchange` subscription — the sniff that covers an agent reading
  `window.__webmcp_registered_tools` straight). So a visitor with no agent still
  pays nothing but the polyfill, and native support skips it and registers at
  once. `tools/` is one module per tool over two shared ones —
  `tools/content.ts` (the cached nav/page reads) and `tools/utils.ts` (agent
  input coercion + URL/result shaping); `tools/index.ts` assembles them in the
  order the agent sees. Tools wrap existing machinery (the MiniSearch index, the
  `useAsyncData` caches, the router) — never a second data path. The two tools
  answering with PROSE (`search_docs`, `read_page`) return `utils.ts`'s
  `textResult`, MCP's `{ content: [{ type: "text" }], structuredContent }`
  envelope: the browser JSON-stringifies whatever `execute` returns, so a page of
  markdown in a plain field reaches the client's model with a literal `\n` per
  newline and a backslash per quote. The prose goes in `content` ONLY — copying
  it into `structuredContent` as well would double the payload for exactly the
  client that cannot unwrap it — and metadata-only tools stay plain objects,
  since the envelope buys them nothing. Every tool also declares an
  `outputSchema` (`tools/schemas.ts`) for that structured half — the field is
  MCP's, NOT WebMCP's, so a native `registerTool` drops it (WebIDL discards
  members it does not declare) and it reaches the polyfill's registry readers and
  MCP bridges; the tool DESCRIPTION is the half that survives both paths, so it
  still names the fields an agent must act on. The schemas are CLOSED
  (`additionalProperties: false`) and `webmcp.test.ts` validates every branch of
  every tool's real result against them, so an undescribed field fails there
  rather than surprising an agent. Unregistration
  is `AbortSignal`-only (the spec's sole teardown), which is also what makes an
  HMR re-setup safe. WebMCP has NO `resources` primitive (tools are the whole
  surface), so project/page links are tool RESULTS instead — `links.ts` derives
  them from the docs config, mirroring the URL conventions `SocialButtons.vue`,
  `AppFooter.vue` and `pages/[...slug].vue` already render. Reusing those caches
  has ONE rule (see the invariant below): a path an agent typed never goes
  through the docs page's `useAsyncData` key. An agent-supplied path also
  resolves config `redirects` before anything judges it real (`resolveDocsPath`,
  same map and same one hop as `router.ts`) — agents work from old links far
  more than visitors do; `navigate` still pushes the path the agent ASKED for,
  leaving the redirect for the router to execute.
- `pnpm test`, `pnpm typecheck` (bare tsc, so `.vue` imports don't resolve),
  `pnpm lint` / `pnpm fmt` (oxlint + oxfmt — run before finishing),
  `pnpm build:inline` after touching `src/app/inline/*.ts`.

## Invariants (do not break)

- **HTTP boundary.** node/wasm deps (`md4x`, `rangi`, `automd`, `takumi-js`,
  `node:*`, `c12`) live only under `src/server/`. Pages reach content solely
  through `/api/docs/*` and `virtual:undocs/app-config` — never by importing the
  engine. Verify no engine import leaks into the client bundle. On the server
  that `$fetch` is request-scoped and does NOT forward the incoming request's
  cookies/headers (fine — these routes are public).
- **Per-request state on the server.** The server renders many requests
  concurrently in one process. Never add module-level mutable state to
  `src/app/**` code that runs during render — put it on the ALS
  `UndocsServerContext` (`ssr/server-context.ts`), or key it so the client
  reproduces it. `server-context.ts` is node-only; composables touch it only
  inside `import.meta.server` branches (DCE'd from the client bundle). The
  `ContentIndex` and proxy caches in `src/server/` are process singletons — that
  is correct there: server-only and visitor-independent.
- **Hydration parity.** The SSR render and the client's _first_ render must
  produce identical DOM. Defer `localStorage`/color-mode/random/time reads to
  `onMounted` or route them through the seeded payload; fence browser-only code
  with `import.meta.client` (or `!import.meta.server`) and node-only with
  `import.meta.server`. Payload seeding (`hydrateAsyncData`/`hydrateState`/
  `seedClientIcons`) MUST run before `createSSRApp`. The inline `<head>` programs
  are the one exception, and only because they stay OUTSIDE the hydration root:
  `inline/color-mode.ts` reads `localStorage` before first paint but only touches
  `<html>`'s class. Anything that RENDERS from the mode (`ColorModeButton.vue`)
  must still show `DEFAULT_COLOR_MODE` on its first client render and correct
  itself `onMounted` — the server always rendered the default.
- **The project's own mark is a build INPUT, in two forms.** `app-config.ts`
  parks the `DOCS_ICON_ASSET` marker in `docs.logo` when the logo is the docs
  project's own detected `icon.svg`, and the `virtual:undocs/app-config` plugin
  swaps it for two bundler imports of that file: `?raw` → `docs.logoSvg`, the
  MARKUP `AppLogo` inlines (no request, no data-URI encoding, and the SVG takes
  the caller's CSS — the footer's `grayscale`, `currentColor`), and `?url` →
  `docs.logo`, for the one consumer that can only take a URL, the favicon
  `<link>`. Carrying both duplicates the icon in each bundle only while it is
  small enough to inline; over `assetsInlineLimit` the `?url` copy is just a
  path. A `logo` the AUTHOR wrote is a URL they own — never touched, and given no
  `logoSvg`, so it stays an `<img>`. Two rules hold this up.
  (1) The `assetsDir`/`assetFileNames` pair the `ssr` env repeats from `client`
  in `vite.config.ts`: BOTH envs import this module and each resolves `?url` to a
  URL of its own making, so without the pair the server renders
  `/assets/icon-<hash>.svg` and the client hydrates against
  `/_undocs/icon-<hash>.svg` (and the file is emitted twice). Only assets OVER
  `assetsInlineLimit` show it — a small icon inlines to the same `data:` URI
  either way, which is why the docs fixture cannot catch it.
  (2) `AppLogo`'s `v-html` is safe for the same reason the `.docs/` theme layer
  is: the file is the docs project's own and is read at BUILD time. Inlining it
  twice per page also means any `id` inside the SVG appears twice — fine for a
  self-contained mark, wrong the moment one is referenced across documents.
- **`components/ui/primitives/` is ours, and it is MIT-derived from reka-ui.**
  reka-ui is no longer a dependency, which makes the attribution comment at the
  top of each file MORE load-bearing, not less — it is now the only record of the
  derivation. Those headers also carry the "dropped, and why" list, which is what
  stops the next reader re-adding a submenu grace area nobody needs. Never strip
  them; credit anything further you port the same way. Three rules the layer runs
  on:
  - **The module-level stacks are browser-only, and that is what makes them
    legal.** `useDismissableLayer`, `useFocusScope`, `useBodyScrollLock` and
    `useHideOthers` each keep a module-level stack/set/WeakMap, because "which
    layer does this Escape belong to" is a question about the document, not about
    a request. Every one returns early under `import.meta.server` and is keyed by
    DOM elements, so nothing is ever WRITTEN during SSR — the only reason they do
    not violate the per-request-state invariant. Any new primitive must keep that
    shape: if it can write module state during a render, it is a concurrency bug
    waiting for a second visitor.
  - **Generated ids come from Vue 3.5's `useId()`, never a counter.** A
    module-level counter would hand two concurrent SSR renders the same
    `aria-describedby` and mismatch on hydrate. Use `useId()` for every `aria-*`
    id.
  - **`usePresence` is what makes every `data-[state=closed]:animate-out` class in
    the codebase work.** A plain `v-if` removes the node in the same tick the exit
    class appears, so the keyframes never get a frame. Delete or bypass it and
    nothing throws — dialogs, tooltips and menus just start vanishing instantly,
    everywhere, and the classes that look like they animate them are silently
    dead. The state machine is unit-tested (`test/app/presence.test.ts`); the
    computed-style plumbing around it is not, because vitest runs in `node`.
- **`tokens.css` is ROLES, not scales, and it is MONOCHROME.** The file used to
  transcribe eight of Geist's 10-step hue ramps plus a 10-step alpha ramp in both
  modes — 160 declarations — to serve about fifteen call sites. Those scales are
  gone. What is left is three kinds of thing: a semantic colour (a role, declared
  as a literal in `:root` and again in `.dark`), a metric (radius, control
  height, grid geometry, elevation), and a type step. Geist's step numbers survive
  only as provenance in the comments; `--color-<hue>-*: initial` is gone with
  them, so Tailwind's own ramps are back and mean what they normally mean.
  `--primary` is the high-contrast pair (near-black on white, near-white on
  black) and is NOT the project's colour; the per-project accent is `--brand`,
  aimed by `theme-brand.ts` from `docs.themeColor` — which DEFAULTS to `mono`,
  i.e. `--brand: var(--foreground)`, no hue at all (Geist's own look; the hue
  table is the departure). Links, active nav, icons and
  the landing glow use `brand`; solid buttons and the high-contrast bar use
  `primary`. Collapsing the two undoes the system. ONE button departs
  deliberately: the landing hero's lead CTA (`color: "brand"`, applied by
  position in `pages/landing.vue`) takes the accent so the docs' colour leads the
  page — if a second call site appears, the two roles have merged after all. It
  takes it as a SOLID FILL (`variant: "solid"`), which is what
  `--brand-foreground` and `--brand-hover` exist for: the fill/label pair is
  measured, not chosen — across the hues
  `themeColor` can pick, in both modes, `--brand-foreground` is the only label
  clearing AA on a solid accent fill.
  `test/app/tokens.test.ts` re-derives every text/surface contrast from the
  stylesheet rather than pinning literals.
- **Glass is for a surface with a real backdrop, and there are exactly TWO.**
  The landing hero's code block (`.hero-code`, styled in `pages/landing.vue`'s
  scoped block) and the search palette's panel (`.search-panel`, in
  `DocsSearch.vue`'s). Each has something to show through — the landing's
  `FireplaceBackground`, and the page a modal covers — which is the whole
  qualification: the same treatment on a docs page block is just a lighter
  block. The three rules below hold BOTH panes up; the palette meets (1) by
  passing `Dialog` an `overlayClass` WITHOUT the shell's default
  `backdrop-blur-sm`, since the overlay paints under the panel and blurring
  there would make the panel's own filter a second pass over an already-blurred
  image (the shell's default keeps the blur, for `Mermaid.vue`, which has no
  glass of its own), and it dims only 30%: THE OVERLAY DECIDES WHETHER THERE IS
  GLASS AT ALL. It paints under the panel, so it is most of what the panel's
  filter averages over — at the shell's `/80` no page is left in frame and the
  pane is a wash of overlay colour however thin its own fill gets. Which is also
  why the palette answers (3) differently from the hero: a pane over an arbitrary
  page has no worst case until the BACKDROP is bounded, so the filter carries a
  per-mode tone clamp (`--panel-glass-tone`: `contrast()` compresses what is
  behind toward mid, `brightness()` lands that band where the mode's own page
  sits) and the fill is only 50% `--card`. The clamp is what pays for both the
  thin fill and the thin overlay; retune the three together, since a dense field
  of small `--muted-foreground` labels is what the mix has to keep above AA. The
  landing's lead CTA stands in the same firelight as the
  hero pane and deliberately does NOT take the treatment: a solid `--brand` fill
  is one of the shapes, and the fire is its contrast rather than its material.
  Three things hold a pane up.
  (1) It blurs ONCE. Per filter-effects-2 the backdrop root here is the
  document (`isolation`, which `PageHero` sets, does not form one), so the fire
  is in frame; a second `backdrop-filter` on a surface inside the pane re-blurs
  an already-blurred backdrop for another offscreen pass. The block's tab bar,
  active tab and copy button are TINTS over its one pane.
  (2) `@supports` runs the enhancement way round — no `backdrop-filter`, no
  translucency — because translucency without blur is not glass, it is the fire
  showing through the code.
  (3) Contrast is what bounds the mixes: the hero's fill is >60% `--muted` so the
  syntax colours `theme.test.ts` pins against `--muted` still hold.
- **The accent is ONE token, and what makes that possible is a rule about
  SURFACES.** `--brand` text sits on the page, on a card, or on a wash of itself
  (≤15%) — never on `--muted` or `--accent`. The `--brand-<hue>` table derives
  each hue in OKLCH against exactly that set: Geist's hue angle, lightness at the
  4.55:1 boundary (or at the top of the accent band where a hue has contrast to
  spare and its gamut cusp is higher — dark amber/green/teal), chroma at the sRGB
  gamut edge. Three consequences.
  (1) It is a PER-MODE table: the constraint is against a different page colour in
  each mode and binds from opposite directions. Adding a hue means two
  declarations. `--brand`/`--brand-foreground`/`--brand-hover` are `var()`
  references INTO that table, so they must NOT be redeclared in `.dark`.
  (2) There used to be three tokens (`--brand`/`--brand-deep`/`--brand-vivid`)
  because no single value cleared AA across a wider surface set — and the deep one
  still measured 4.38–4.49 on `--accent`, i.e. under AA. Constraining the surfaces
  fixed that; re-widening them brings the split back.
  (3) The rule is enforced on the SOURCE: `tokens.test.ts` greps `src/app` for
  `text-brand` on `bg-accent`/`bg-muted` and fails. An active nav item wants
  `bg-brand/10 text-brand`.
- **`mono` is the default accent, and its hover goes the OTHER WAY.**
  `--brand-hover` (one consumer: the hero CTA) mixes the fill 12% along the
  neutral axis toward `--brand-hover-toward`, and that pole is the one thing the
  two kinds of accent disagree about — so `brandCss` emits it WITH `--brand`,
  always, and neither is ever set alone. A hue moves toward `--foreground`, away
  from the page and so away from the label (the label IS the page, so its
  contrast only improves; the reflex `bg-brand/90` recedes toward the page and
  lands at ~3.7). Mono's accent already IS `--foreground`, so that pole is the
  identity and the button gets no hover at all; it recedes toward `--background`
  instead, exactly as `--primary-hover` does. `tokens.css` seeds mono's pair, so
  a hue emitting only `--brand` would inherit mono's direction — which is why the
  emission is unconditional and `theme-brand.test.ts` pins both poles.
- **Status colour is FIVE roles, each a triple.** `--info`/`--success`/
  `--warning`/`--danger`/`--important`, each with `-tint` (the surface its text
  sits on) and `-border`. `Alert`, `ProseCallout` and `Banner` render all three
  with no `dark:` variant anywhere, which only works because every pairing is
  declared per mode. Adding a role means six declarations and an entry in the
  test's `STATUS` list.
- **The type scale is declared ONCE, in `@theme static`.** `static` is
  load-bearing: `inline` substitutes values into the utilities and emits no
  variables (so plain CSS cannot read it), and a default `@theme` tree-shakes the
  unused ones. `static` emits every variable AND generates every utility, so
  `main.css`'s prose rules — which style bare `h1`/`p`/`table` tags, not utility
  classes — read the same `--text-heading-32` / `--text-heading-32--line-height`
  the `text-heading-32` utility compiles from. It used to be two parallel blocks.
  Colours cannot use this trick (they need `.dark`, and `@theme` cannot nest), so
  they stay a `:root`/`.dark` literal plus an `@theme inline` mapping — which is
  also why `theme-brand.ts` may emit `var(--brand-blue)` but never
  `var(--color-…)`: the former is a plain custom property and survives.
  `--font-sans`/`--font-mono` are the same pattern, in `main.css`.
- **Control heights come from `--size-*`, not from `h-<n>`.** Geist's ladder
  is small 32 / medium 36 / large 40; `tiny` 24 is ours (the Button has the size,
  upstream ships no token). `Button.ts` writes them as `h-(--token)`, and
  `buttonSquareSizeClass` reuses the same token for width so the two cannot
  drift. Each height carries Geist's paired type step (14px through medium, 16px
  at large) — height alone is not the size.
- **The Geist grid resolves breakpoints in JS, draws guides as grid ITEMS.**
  `components/grid/`: `GridSystem` (guides on) > `Grid` (`columns`/`rows`, number
  or `{sm,md,lg}`) > `GridCell` + `GridCross`, plus `GridPage`, the page shell
  wrapping header/main/footer in `app.vue`. Three things are load-bearing.
  (1) Breakpoints resolve in `responsive.ts` into `--ug-*-{sm,md,lg}` triples
  that plain media queries pick from (Geist's sm/md/lg → base / 48rem / 64rem). A
  `matchMedia` read would give SSR one column count and the client's first render
  another — the hydration mismatch forbidden above.
  (2) Guides are grid items bordering a track edge inside an overlay repeating
  the same template, NOT lines at `calc(i * 100% / cols)`, so track rounding
  applies to guides and cells identically instead of drifting a pixel apart.
  Because a line COUNT is fixed in markup and no media query can add DOM nodes,
  `guideLayers()` emits one overlay per distinct shape and the CSS swaps them; it
  may only merge ADJACENT breakpoints, since each query hides the one below it.
  (3) Cell spans travel through a custom property, which substitutes as a raw
  token stream, so `gridLine()` MUST space the slash — `1/-1` unspaced is dropped
  at computed-value time and the cell silently reverts to auto placement.
  The outer frame is the grid's own border (the overlay's `inset: 0` resolves
  against the padding box, which is where the tracks live).
- **The shell is FULL-BLEED; the content column is what's capped.** `GridPage`
  wraps header/main/footer but sets no width — it exists for `position: relative`
  (the landing `FireplaceBackground`'s containing block, the one element
  spanning all three). Width comes from `Container`, which every piece of chrome uses, at
  `--ui-container`, base 76.25rem/1220px — Geist's own `max-w-[1220px]`, not its
  published `--geist-page-width`/`--ds-page-width` tokens (1200/1400), which that
  page never references. So content centres while every horizontal rule
  (`DocsSectionTabs`'s `border-y`, `AppFooter`'s `border-t`) runs to the
  viewport. That token STEPS with the viewport (88rem at 1440, 92rem at 1920) and
  the steps stay on the ONE token: widen only the docs body and the header's and
  footer's rules end short of the content above them. Because `Page`'s side
  tracks are FIXED (`--ui-aside`/`--ui-toc`) and its content column is the only
  one that flexes, the container alone sets the prose MEASURE — which is why the
  1920 step moves the rails by exactly what it adds to the container, holding the
  measure where 1440 left it. Keep that arithmetic when adding a step. If you ever re-box the shell, put the max-width and rails on
  `GridPage` itself rather than drawing an overlay at the same coordinates, which
  cannot clip the chrome's own borders. We deliberately do NOT tint the page the
  way Geist does in light: our `--card` IS that step, so the page would swallow
  every card.
  The grid's rules are SOLID (dashed is `Grid`'s `dashedGuides` opt-in) and come
  from `--grid-guide`, a solid colour rather than the alpha `--border`, because
  an 8%-black hairline tints with the landing backdrop behind it. Their per-mode
  values are NOT a flip of one another: Geist's neutral ramp is not symmetric
  about the two page backgrounds, so a step that separates from white is a bright
  scratch on a 4% page.
- **`cn()` must know the Geist type classes.** tailwind-merge decides a `text-*`
  utility is a SIZE only from a size-shaped suffix, so `text-button-14` and
  `text-heading-32` land in the font-COLOR group and get silently dropped by any
  real colour in the same call — the class vanishes and the element renders at
  the inherited size. `utils/cn.ts` re-registers every Geist size into
  `font-size`; `test/app/cn.test.ts` guards it. Adding a step to the scale in
  `tokens.css` means adding it there too.
- **A page's SOURCE is served through one helper, and its links are routes.**
  `content/source.ts`'s `pageSource()` is what `/raw/<path>.md` and
  `llms-full.txt` return (and so, through `/raw`, what `read_page` and the docs
  page's "copy as markdown" hand out): frontmatter stripped, a title/description
  ensured for a page that carries them in frontmatter, and file-relative links
  (`./2.getting-started.md`, `../guide/1.index.md#anchor`) resolved to route
  paths. That last part is not cosmetic — those hrefs are repository paths, so
  an agent following one asks for a route that does not exist, `NN.` prefix and
  all. It resolves through `transforms.ts`'s `resolveMdHref`, the SAME function
  the AST pass uses on the rendered page, so the two views of a page cannot
  disagree about where a link points. The text scan is line-wise so it can skip
  fenced code blocks — a page quoting markdown link syntax is not linking — and
  it is deliberately the whole story: do not re-add per-route frontmatter/title
  handling, or the two text routes drift again.
- **Raw HTML is resolved server-side.** `transforms.ts`'s `liftRawHtml` turns
  md4x's `html` nodes into `_html` nodes the client injects with `v-html`. Moving
  this client-side breaks escaping and security. An inline `html` node is ONE
  TAG, not an element, so a matched pair has to be merged with the text between
  it into a single node — split across two `v-html` spans the browser closes
  `<span><b></span>` itself and the markup is lost. The merge only runs while
  that interior is plain text; a run holding a real element would need an
  AST→HTML serializer, so its fragments stay separate. Text is NOT scanned for
  `<` any more: md4x distinguishes a real tag from a literal one, so `3 < 5` is a
  string and Vue escapes it.
- **HTML entities arrive RESOLVED; undocs owns no entity table.** md4x (0.0.29+)
  resolves them in the AST's text nodes and in a link's/image's destination, so a
  `&copy;` reaches `MarkdownRenderer` as `©` — which is what a Vue text vnode
  needs, since Vue escapes it and any surviving entity source would render as its
  own spelling. undocs used to redo this itself (`entities.ts`, deleted); do not
  reintroduce it. Three kinds of text stay SOURCE, and matching that is still
  load-bearing on our side: code (a code span is verbatim), MDC props (a literal
  attribute value the author typed, not markdown text), and raw HTML, which
  resolves natively through `innerHTML`. The last one is why `inlineSource`
  escapes `&`: the text it merges into markup is plain by then, so an author's
  `©` would otherwise go back in as an entity and decode a second time on its way
  into the DOM. `test/content/transforms.test.ts` parses real markdown to pin all
  four behaviours, because they are md4x's promise rather than ours.
- **The WebMCP polyfill is ours, and it is Apache-2.0-derived from Google's
  reference polyfill.** `webmcp/polyfill.ts` exists because native
  `document.modelContext` is barely shipping, so the agents that can use our
  tools TODAY are the ones written against that file — which is why it keeps the
  two things they bind to: the `window.__webmcp_registered_tools` registry under
  that exact name, and `executeTool` (the reference polyfill's own invention,
  which the spec has since adopted). Where the two disagree the SPEC wins, since
  a polyfill's job is to be indistinguishable from native: `executeTool` resolves
  the result SERIALIZED to a JSON string, as the spec's execute steps do and the
  reference does not — a client that renders what it got prints `[object Object]`
  otherwise. Same rules as `ui/primitives/`: the attribution
  header is the only record of the derivation, and its "dropped, and why" list —
  declarative `form[toolname]` tools, the `:tool-form-active` shim that re-fetches
  every stylesheet, and the `postMessage` bridge that would hand ANY embedder our
  `navigate` tool — is what stops the next reader porting them back. Registered
  tools carry a STRINGIFIED `inputSchema` because consumers `JSON.parse` it,
  even though the spec's own field is now the object (`types.ts` covers both).
  `outputSchema` — carried through beyond the reference, since the registry is
  the only place these shapes can reach an agent — is deliberately NOT
  stringified with it: the stringification is compatibility owed to consumers
  that already parse that one field, and a field nothing has ever read takes
  MCP's own shape instead.
- **An agent-supplied path never touches the docs page's cache key.** The docs
  page keys its `useAsyncData` by `kebabCase(route.path)`, which is lossy
  (`/guide/deploy`, `/guide-deploy` and `/Guide/Deploy` collapse onto ONE entry),
  and `queryPage` resolves a 404 to `null` instead of throwing. So looking up an
  unvalidated path through `webmcp/tools/content.ts`'s `page()` would cache `null` under
  a REAL page's key and 404 the visitor's next navigation there. Proving the
  path real does NOT earn the key either — two paths that BOTH exist collide the
  same way, and the visitor gets the other page's title/description/outline.
  Agent input goes through `probePage`/`routeExists` (own key namespace);
  `page()` is only for the visitor's own route. The search palette's preview pane
  (`DocsSearchPreview.vue`) is the other reader of a path that is not the
  visitor's route, and it stays off `useAsyncData` entirely: it fetches a page
  per arrow-key step, so even its own namespace would leave one permanent entry
  per hovered page in a store that never evicts. Its cache is an
  instance-local `Map` — instance, not module, so "never written during SSR"
  holds by construction rather than by comment.
- **The search preview renders the page's OWN AST, and the pane is `inert`.**
  `DocsSearchPreview.vue` slices the fetched `body.value` from the matched
  heading (`utils/search-preview.ts`'s `previewNodes`) and hands it to
  `MarkdownRenderer` — never a second markdown parser in the browser. The AST it
  already has is the TRANSFORMED, rangi-HIGHLIGHTED one; re-parsing markdown
  source client-side would pull in a wasm parser to arrive at strictly less
  (unhighlighted fences, unresolved links, no MDC components). Four rules hold
  the pane up.
  (1) `MarkdownRenderer` is dynamically imported under a LOCAL `<Suspense>`. The
  boundary is not optional: without it the async component joins `AppPage`'s
  `<Suspense>` and a palette preview holds the whole PAGE. Its fallback is
  `previewBlocks`, a flat text outline off the same AST, so the pane is never
  blank — on a docs page the chunk is already resident and it flashes for a tick,
  on the landing page (which never loads it) it covers a real fetch.
  (2) The rendered subtree is `inert`. `MarkdownRenderer` emits real links, real
  `#` heading anchors (which `scrollTo` the window) and real copy buttons; inside
  a focus-trapped dialog those are a navigation hazard AND a Tab stop apiece.
  `inert` is one attribute for both, with `pointer-events-none` alongside for
  browsers predating it — and it is what lets a click fall through to the
  scroller, which opens the result.
  (3) Heading ids are namespaced (`search-preview-`). The renderer stamps an `id`
  on every heading, slugifying one where the node has none, so the pane would
  otherwise duplicate the ids of the page BEHIND the modal — the same page, in
  the common case of searching from the page you are reading.
  (4) `.md-preview` in `main.css` re-steps the `.md` scale for a ~30rem column and
  must stay AFTER the `.md` rules: both classes land on the one `.md-body`
  element, so equal specificity means source order decides. It changes SIZES AND
  SPACING ONLY — colours, highlighting, callouts and tables render exactly as the
  page renders them, which is the entire point.
- **Heading anchors come from md4x, at parse time.** It slugs every heading
  GitHub-compatibly, de-duplicates within the document (`same`, `same-1`) and
  honours an explicit `## Title {#anchor}`, stamping the result on the node.
  `buildToc` READS that id — the TOC, `search.ts`'s section keys and the rendered
  DOM are all the one derivation. Re-deriving in undocs is what this replaced,
  and it cannot be reintroduced: any later pass counts a different heading LIST
  than the parser saw (the page's `h1` is spliced out, raw-HTML headings never
  reach the renderer), so its suffixes drift and the TOC links point at nothing.
  Only a heading md4x slugs to nothing (`## 🚀`) is numbered here, clear of the
  ids already on the page.
- **Router uses a runtime `typeof window` check** (`IS_BROWSER`), not
  `import.meta.client` — the latter is `undefined` in the dev browser and would
  pick memory history on the client, breaking hydration.
- **A foreign anchor is captured; a foreign `pushState` is not.** `AppLink` routes
  the links the app renders, but raw HTML in markdown (`_html` nodes, injected
  with `v-html`) and anything a third-party script appends are plain anchors that
  full-reload the site. `link-capture.ts` installs ONE delegated `click` listener
  from `main.ts`, in the BUBBLE phase: by then a component that wanted the click
  has run and either called `preventDefault` (skipped) or stopped propagation
  (never seen), which is also exactly what stops it double-navigating on top of
  `AppLink`'s own handler — capture phase would preempt them all. A scripted
  `location.href` assignment is deliberately NOT covered: `Location`'s members are
  `[LegacyUnforgeable]`, i.e. non-configurable own properties, so nothing can
  patch them, and only the Navigation API's `navigate` event would — a separate,
  feature-detected layer.
  `history.pushState` is left alone on purpose too, since a foreign script pushing
  state is usually tracking its OWN state rather than navigating.
- **What the app renders is a DENYLIST** (`utils/routes.ts`'s `isAppRoute`),
  because `router.ts`'s last record matches everything: hand `push()` a path NITRO
  answers (`/llms.txt`, `/raw/x.md`, `/api/docs/*.json`, `/icon.svg`, the client's
  own `/_undocs/*` chunks) and a working request becomes an SPA nav rendering a
  docs 404. It mirrors `nitro.config.ts`'s `handlers` plus Vite's `assetsDir`, and
  `test/app/routes.test.ts` greps both configs so the mirror cannot drift out of
  them silently. Two rules inside it: `/api/docs/` and `/api/_content`, never
  `/api/` — a library documenting its API owns `/api/config` — and the file check
  is a CLOSED extension list, since `docs/nuxt.config.md` is a page at
  `/nuxt.config`. Both DOM-side consumers ask it: the click capture above, and
  `AppLink`, whose rooted-but-not-a-route branch keeps the anchor a real request
  instead of forcing `_blank` the way its external branch does.
- **Loading-bar release.** `AppPage`'s `<Suspense>` `onResolve` (and its
  `onErrorCaptured`) must call `router._pageRendered()`, or a slow/errored page
  leaves `router.pending` — and the nav loading bar — stuck on.
- **Only a page's own content may be awaited.** Every `await useAsyncData` in a
  page's subtree — including one in a nested component like `PageSponsors` —
  joins the SAME `AppPage` `<Suspense>`, and on a CLIENT-side navigation there is
  no payload to seed it from. So one slow third-party proxy holds the whole
  incoming page (hero included) and the loading bar behind it, while the previous
  page stays on screen. Blocks that are not the page's content pass
  `{ lazy: true }`: SSR still fetches and serializes them, the client renders the
  page at once and the block fills in reactively (it is `v-if`'d on its own data).
- **Single shared highlighter.** Doc content and the landing hero both go through
  the one `highlightCode` (`rangi`), so both get the same grammars and the same
  fence-alias table. It is SYNCHRONOUS — rangi returns markup, not a promise —
  and so are `highlightBody` and `highlightCode`.
- **Token colours are styled, not inlined.** `highlightCode` runs rangi with
  `classes: true`, so each token is `<span class="shj-<type>">` and the palette
  lives in `assets/main.css` (~37% smaller markup raw, ~7% gzipped). Both
  branches of each `light-dark()` there are **Vesper** — the dark one mapped from
  its TextMate scopes onto rangi's token types, the light one derived from that
  in OKLCH (Vesper publishes no light variant). rangi ships no vesper either, so
  `main.css` is the only copy of both and there is NO upstream to sync with:
  `test/content/theme.test.ts` pins each colour, asserts every one clears WCAG AA
  against `--muted` (read from `tokens.css`, so restyling the neutrals
  fails there), and pins the italic on `.shj-cmnt`. Retune a token only with that
  contrast check in hand. A rangi upgrade can ADD a token type, which renders
  unstyled until the palette gains a rule; the coverage test catches that.
  `html.light`/`html.dark` map to CSS `color-scheme` in `main.css` — those two
  declarations are LOAD-BEARING: without them `light-dark()` resolves to its
  light branch in dark mode and every code block renders wrong. Our own
  `.code-hl` / `.code-hl-lang-*` wrapper classes carry layout only.
- **Prefer upstream over a local grammar.** Only `mdc` is left in
  `grammars/`, because rangi ships no equivalent. Before adding one, measure
  against the bundled grammar; before keeping one, re-measure on upgrade.
- **Local grammars are passed per call, never registered.** `grammars/index.ts`
  builds a frozen `LOCAL_LANGUAGES` record handed to rangi via its `languages`
  option (it applies to sub-languages too). No global registration step, no
  shared mutable cache. A grammar named after one rangi ships REPLACES it and
  must say why via `overridesBuiltin` — `registry.test.ts` enforces that. Rules
  are TUPLES (`[match, type, sub]`), not objects.
- **Aliases: rangi's first, ours only for the gaps.** rangi spreads its own
  aliases into the same `languages` record as the grammars, so they resolve
  through `KNOWN_LANGS` for free. `LANG_ALIASES` in `highlight.ts` holds only
  what rangi lacks — deliberate approximations (`mdx`→md, `console`→bash) and
  vendor spellings (`shellscript`, `c++`). `BUNDLED_ALIASES` inverts rangi's
  table by OBJECT IDENTITY (an alias entry IS its grammar, not a copy) so every
  spelling collapses to one canonical `code-hl-lang-*` class.
- **Prod docs-dir fallback.** The baked absolute `runtimeConfig.undocs.dir` may
  not exist on a deploy; `store.ts`'s `resolveDir` falls back to
  `<nitro-main>/docs`, populated by `bundle-docs.ts`. Keep the two glob/exclude
  rules in sync.
- **Config redirects are enforced twice, from one map.**
  `src/app/utils/redirects.ts` (client-safe, no node imports) normalizes the docs
  config's `redirects`; `nitro.config.ts` turns it into `routeRules`
  (`{ redirect: { to, status: 301 } }` — moved pages, so ranking transfers) and
  `router.ts` resolves the same map for CLIENT navigations, which never reach the
  server. Note that ANY route rule with a runtime handler
  (redirect/headers/cors/proxy/cache) makes nitro's generated
  `#nitro/virtual/routing` `import "h3-rules"` — a bare specifier resolved
  against the Vite root, i.e. undocs, where pnpm does not expose nitro's private
  dep. Until nitro emits a resolvable specifier, that import is what breaks first
  if redirects stop working ("Cannot find module 'h3-rules'", every request 500s).
- **Cross-origin isolation is opt-in and lives on the `/**` rule.**
  `crossOriginIsolation` (`src/server/cross-origin-isolation.ts`) resolves to a
  COOP/COEP pair — `true` means `credentialless`, `require-corp` is the strict
  alternative — that `nitro.config.ts` folds INTO the existing `/**` ISR rule, not
  a second `/**` key, which would replace it on spread. One declaration covers dev
  and the built server. It is not narrowed to HTML routes because a route rule can
  add a header but not remove one; COOP/COEP are inert on the JSON/markdown/PNG
  routes anyway. It is the second producer of a runtime-handler route rule, so the
  h3-rules note above applies to it too.
- **The client bundle's assets dir is not ours alone to choose, so the name
  patterns stay UNSET.** `vite.config.ts` asks for `_undocs`; Vercel's
  `immutableStaticFiles` (turned on in `src/server/vercel.ts`) repoints the whole
  client build at `_vercel/immutable/<VERCEL_HASH_SALT>/undocs` — the only path
  that host serves from its cross-deployment store — by setting
  `nitro.options.buildAssetsDir`, which nitro's vite plugin writes into
  `build.assetsDir` for the `client` and `ssr` envs alike (so hydration parity
  survives the override). It supplies `entry`/`chunk`/`assetFileNames` in the
  same pass, but ONLY where each is unset: a pattern of our own has to spell the
  dir itself — a rollup/rolldown name is relative to `output.dir`, and there is
  no assets-dir token — and nitro will not rewrite what it finds (a string only
  has its `[hash]` widened, a callback is opaque). So OUR dir is the one that
  survives, which leaves the entry chunk in the immutable dir and every other
  chunk outside it. Nitro does not warn (its manifest check fires only at ZERO
  files, and one file is not zero), so nothing catches it but a look at the
  output. We used to have such callbacks, for readable chunk names; they are
  gone, and the names are worse for it (`_...slug_` twice, `dist` for mermaid).
  That is a KNOWN trade, and the cheap-looking ways out have been measured:
  `codeSplitting.groups` and `manualChunks` name chunks without touching the dir,
  but either one switches rolldown off its default per-dynamic-import splitting —
  `MarkdownRenderer` merges into the docs page chunk, so the LANDING page's
  search preview pulls it, breaking the boundary the preview invariant rests on.
  Readable names cost a plugin that reads `build.assetsDir` back after nitro has
  set it; there is no free version. Runtime code that must RECOGNISE a bundle URL
  sidesteps all of this: `assets-base.ts` lists `/_undocs/` and the reserved
  `/_vercel/immutable/` as constants, which is also why `isAppRoute` denies
  `/_vercel/` whole rather than mirroring the dir inside it.
- **Output lives in the docs dir, via rebase — not `rootDir`.** Nitro's `rootDir`
  MUST stay `pkgRoot`: it drives both c12 config discovery (finding our
  `nitro.config.ts`) and builder-package resolution (`vite` is undocs's dep, not
  the docs project's). Repointing it at `docsDir` breaks both. To still write
  output into the docs project, `rebaseOutput` (`src/server/rebase-output.ts`,
  first in `modules`) rewrites `output.{dir,publicDir,serverDir}` from the
  `pkgRoot` base to `docsDir` in its `setup` — preserving the preset's shape
  (never a hardcoded `output.*` override). It runs before the
  `vercel`/`bundleDocs` `compiled` hooks that read those paths.
- **Dev-only stays dev-only.** `dev-watch`/`dev-ws`/`dev-reload` and
  `metaEnvFlagsDev` must never ship in `.output/server`.
- **Inline `<head>` programs are compiled, never hand-written.** Edit
  `src/app/inline/<name>.ts`, then `pnpm build:inline`; commit BOTH files. The
  `.js` is what ships (inlined verbatim into every HTML response), so a stale
  artifact silently serves old behaviour — `test/app/inline-build.test.ts` runs
  the real build and fails on drift. They are excluded from oxlint/oxfmt
  (`ignorePatterns`) because they are generated, and carry NO banner/comments —
  the text ships on every HTML response. Keep them self-contained: every import
  is inlined, and this is bytes on every page. Order in the shell matters:
  `color-mode` before `embed-theme` (an embedder's pinned mode must win).
- **The dev SSR entry must be re-imported on every app change.** Nitro's dev
  worker imports `entry-server.ts` ONCE and keeps that module namespace, so a
  Vite HMR update leaves the entry — and its whole STATIC graph (`app.vue`,
  `router.ts`, `AppPage`, …) — stale, while the page components the router pulls
  in via `import()` at request time re-evaluate fresh. Two copies of `router.ts`
  then meet in one render and the page's `useRoute()` injection misses
  (`Symbol(undocs-route)` not found). `ssrEntryReloadDev` (vite.plugins.ts) sends
  `{ type: "full-reload" }` on the `ssr` env's hot channel — the message Nitro's
  worker reloads entries on — whenever a changed file is in the SSR graph.
  Anything else that invalidates an SSR module by hand (the `virtual:undocs/*`
  watchers) must reload through `fullReload(server)`, not a bare `server.ws.send`
  (browser-only).
  The reload is a RACE, not a barrier, and cannot be made one from our side:
  nitro's dev worker swaps its entry namespace only after `runner.import()`
  resolves and serves every request in the meantime from the PREVIOUS entry
  (nitrojs/nitro#4536), so a straddled render still happens roughly once per
  edit. That is why every INJECTION KEY in `src/app` is `Symbol.for(...)`, never
  `Symbol(...)` — a registry symbol is the same key in both copies, so the
  straddled render succeeds instead of throwing, and the finished reload
  replaces it. Add a key the same way (`router.ts`, `useLanding.ts`,
  `useTooltipGroup.ts`); `useBodyScrollLock`'s per-call `token` is an identity,
  not a key, and MUST stay a unique `Symbol()`.
- **Build flags DCE, except in the dev browser.**
  `import.meta.{server,client,dev,prerender}` are compile-time constants
  (`define` per Vite env), but Vite doesn't apply those `define`s to dev-served
  browser modules — the `metaEnvFlagsDev` plugin (dev-only, `enforce: "post"`)
  does the replacement itself. Keep it. Prefer `!import.meta.server` for client
  checks (robust even without the plugin).
- **Every relative/aliased import carries its file extension** (`./types.ts`,
  `@app/router.ts` — no directory indexes). `tsconfig.json` pins
  `module`/`moduleResolution` to `nodenext` so `pnpm typecheck` fails (TS2835) on
  a bare specifier. Not style: Vite's coming native config loader
  (`configLoader: "native"`) resolves `vite.config.ts`'s import graph with node,
  which has no extension guessing — so anything reachable from `vite.config.ts` →
  `vite.plugins.ts` → `src/server/**` stops loading. tsc does not read `.vue`
  files, so their imports are on the honour system.

## Testing

`test/api.test.ts` exercises every Nitro route via its h3 `.fetch(Request)`
against an on-disk fixture — no running server. `test/content/*` unit-tests the
engine.

## Deferred

Not yet ported: prerender/SSG (see `usePageSEO.ts`'s `prerenderRoutes` TODO) and
Plausible analytics.
