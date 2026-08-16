/**
 * Docs-config redirects (`redirects: { "/old": "/new" }` in `.config/docs.*`).
 *
 * One normalization + matching implementation, shared by the two places that
 * need it:
 *
 *   - `nitro.config.ts` turns the normalized map into Nitro `routeRules`
 *     (`{ redirect: to }`), so a direct request to an old URL is redirected by
 *     the server before it ever reaches the app.
 *   - `router.ts` resolves the same map for CLIENT navigations (an in-app link
 *     to a moved path never touches the server, so the route rule can't fire).
 *
 * Matching mirrors h3-rules' route-rule semantics: an exact key matches that
 * path only; a `/**` key matches the path and everything under it, and when the
 * target also ends in `/**` the matched tail is appended. This file is
 * client-safe (no node imports) — it is the client that dictates where it lives.
 */

/** Normalized `from → to` map, both sides absolute paths (or absolute URLs for `to`). */
export type RedirectMap = Record<string, string>;

/**
 * Normalize the user-authored `redirects` map: drop non-string/empty targets and
 * ensure every key is rooted (`docs` → `/docs`), so the resulting keys are valid
 * route-rule patterns and comparable to a `route.path`.
 */
export function normalizeRedirects(input: unknown): RedirectMap {
  const redirects: RedirectMap = {};
  if (!input || typeof input !== "object") {
    return redirects;
  }
  for (const [from, to] of Object.entries(input as Record<string, unknown>)) {
    if (!from || typeof to !== "string" || !to) {
      continue;
    }
    redirects[from.startsWith("/") ? from : `/${from}`] = to;
  }
  return redirects;
}

/**
 * Does this target leave the app entirely? A redirect may point at an absolute
 * URL (`/changelog` → `https://github.com/…/releases`), which is a full page
 * load rather than a route. Every consumer must agree on the answer — the router
 * hands those to `window.location`, and `webmcp` reports them as off-site
 * instead of describing a page that was never rendered.
 */
export function isExternalRedirect(target: string): boolean {
  return /^[a-z][\d+.a-z-]*:/i.test(target);
}

/**
 * Resolve `path` against a normalized map — the redirect target, or `undefined`
 * when nothing matches. Exact keys win over wildcards; among wildcards the
 * longest (most specific) base wins.
 */
export function resolveRedirect(redirects: RedirectMap, path: string): string | undefined {
  if (Object.hasOwn(redirects, path)) {
    return redirects[path];
  }
  let target: string | undefined;
  let matchedLength = -1;
  for (const [from, to] of Object.entries(redirects)) {
    if (!from.endsWith("/**")) {
      continue;
    }
    const base = from.slice(0, -3);
    if (path !== base && !path.startsWith(`${base}/`)) {
      continue;
    }
    if (base.length <= matchedLength) {
      continue;
    }
    matchedLength = base.length;
    // `/old/**` → `/new/**` carries the tail over; a plain target is a fixed
    // destination for the whole subtree.
    target = to.endsWith("/**") ? to.slice(0, -3) + path.slice(base.length) : to;
  }
  return target;
}
