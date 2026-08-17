/**
 * Which same-origin paths does the APP render, and which does the server answer?
 *
 * `router.ts`'s last record is an unconditional catch-all (`match: () => true`),
 * so every path handed to `push()` renders the docs page — real or 404. That is
 * fine for a target the app produced itself (`AppLink` is fed route paths), but
 * not for a path picked up from the DOM: `/llms-full.txt`, `/raw/guide.md`,
 * `/api/docs/search.json`, `/icon.svg` and the client's own `/_undocs/*` chunks
 * are all same-origin paths NITRO answers, and taking one over turns a working
 * request into an SPA navigation that renders a docs 404.
 *
 * So this is a DENYLIST mirroring `nitro.config.ts`'s `handlers` (plus Vite's
 * `assetsDir` and the `publicAssets` dirs), not an allowlist — the app's route
 * set genuinely IS "everything else", and whether a page exists behind a given
 * path is a question only the content index can answer, asynchronously and on
 * the server. `test/app/routes.test.ts` greps those two configs so the mirror
 * cannot drift out of them silently.
 *
 * Client-safe (no node imports), and consulted by both DOM-side consumers:
 * `link-capture.ts` for a foreign anchor, `AppLink` for an authored one.
 */

/**
 * Path prefixes with something other than the app behind them: Nitro handlers,
 * Vite's built `assetsDir` (`/_undocs/`) and its dev-server namespace (`/@vite/`,
 * `/@fs/`, `/@id/`).
 *
 * `/api/docs/` and `/api/_content` rather than `/api/`, because a docs project
 * with an `/api` SECTION is entirely ordinary — a library documenting its API is
 * the common case, and `/api/config` is one of its pages. Only what a handler
 * actually claims is denied.
 */
const SERVER_PREFIXES = ["/api/docs/", "/api/_content", "/raw/", "/_og/", "/_undocs/", "/@"];

/**
 * Extensions the server answers as a FILE rather than a page.
 *
 * A CLOSED list, deliberately: a docs page may legitimately carry a dot in its
 * name (`docs/nuxt.config.md` → `/nuxt.config`), so "the last segment has a dot"
 * would strand it. `.md` is here because `middleware/raw-redirect.ts` aliases
 * every `.md` path to `/raw/**`, and `.txt` covers `/llms.txt`,
 * `/llms-full.txt` and `robots.txt`.
 */
const FILE_EXT_RE =
  /\.(?:avif|bmp|css|eot|gif|gz|htm|html|ico|jpe?g|json|m?js|map|md|mp3|mp4|otf|pdf|png|svg|tar|tgz|ttf|txt|wasm|webm|webp|woff2?|xml|ya?ml|zip)$/i;

/**
 * Does the app render this path? Accepts a bare path or a path with
 * query/fragment attached, so a caller can pass an `href` as authored.
 *
 * Only ROOTED paths can be app routes: a relative href has no meaning without
 * the page it sits on, and `//host/path` is a protocol-relative URL rather than
 * a path at all.
 */
export function isAppRoute(pathOrHref: string): boolean {
  const path = pathOrHref.split("#")[0].split("?")[0];
  if (!path.startsWith("/") || path.startsWith("//")) {
    return false;
  }
  if (SERVER_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return false;
  }
  return !FILE_EXT_RE.test(path);
}
