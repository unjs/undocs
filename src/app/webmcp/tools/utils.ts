/**
 * Input coercion and URL shaping shared by the docs tools.
 *
 * Everything here deals with what an agent HANDS US (a path it read off an
 * earlier result, a count, an offset) or with what we hand back (absolute,
 * directly-linkable URLs). Nothing here touches the content API — that's
 * `./content.ts`.
 */
import { withLeadingSlash, withoutTrailingSlash } from "ufo";

import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { isExternalRedirect, normalizeRedirects, resolveRedirect } from "@app/utils/redirects.ts";

/**
 * Routes that exist without a page in the content index, so an "is this a real
 * page?" check must not go by `queryPage` alone: the landing page is built from
 * `landing` config (most docs sets have no root `index.md`, and `/api/docs/page/
 * _index.json` 404s there) and `/blog` is a generated listing. Both are route
 * records in `router.ts`.
 */
export const STANDALONE_ROUTES = new Set(["/", "/blog"]);

/** How the docs site names itself, for the tool descriptions. */
export function siteName(): string {
  const appConfig = useAppConfig();
  return appConfig.site?.name || appConfig.docs?.name || "this documentation site";
}

/**
 * Coerce whatever an agent passed into a docs route path. Models routinely hand
 * back a full URL they saw in an earlier result, a `.md` source path, or a path
 * with a trailing slash — all of which should resolve to the same page.
 */
export function normalizePath(input: unknown): string {
  let path = String(input ?? "").trim();
  if (!path) return "/";
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      // Not parseable as a URL — fall through and treat it as a path.
    }
  }
  path = path
    .split("#")[0]
    .split("?")[0]
    .replace(/\.(md|html)$/i, "");
  path = withLeadingSlash(path);
  return path === "/" ? "/" : withoutTrailingSlash(path);
}

/** Where an agent-supplied path actually leads, once config redirects apply. */
export interface ResolvedPath {
  /** The destination: a route path, or an absolute URL when `external`. */
  path: string;
  /** The path the agent asked for, present only when a redirect moved it. */
  redirectedFrom?: string;
  /** The destination is off this docs site, so there is no page behind it. */
  external?: boolean;
}

/**
 * Normalize an agent-supplied path AND follow a configured redirect off it.
 *
 * An agent works from links — a search result it saw last week, a URL a user
 * pasted, a path from an older copy of the docs — so it hits moved paths far
 * more often than a visitor clicking through the current nav does. Without this
 * a `redirects: { "/old": "/new" }` entry that silently works for every visitor
 * (route rule on the server, `router.ts` mirror in the app) would make every
 * tool answer "no documentation page at /old" for a page that plainly exists.
 *
 * Resolution is the SAME call the router makes, on the same map, so the two
 * cannot disagree about where a path leads — and it is ONE hop, also like the
 * router: a chain resolves the rest on the way through it.
 */
export function resolveDocsPath(input: unknown): ResolvedPath {
  const path = normalizePath(input);
  const redirects = normalizeRedirects(useAppConfig().docs?.redirects);
  const target = resolveRedirect(redirects, path);
  // A self-redirect is not a move (the router ignores it too — it would loop).
  if (target === undefined || target === path) {
    return { path };
  }
  if (isExternalRedirect(target)) {
    return { path: target, redirectedFrom: path, external: true };
  }
  // An internal target keeps only its route path here: a `/old` → `/new#anchor`
  // target still scrolls, because `navigate` hands the ORIGINAL path to the
  // router and the router carries the anchor over — this is the "is it real?"
  // path, not the one navigated to.
  return { path: normalizePath(target), redirectedFrom: path };
}

/** Absolute URL for a route path, so results are directly linkable. */
export function pageUrl(path: string, hash = ""): string {
  const origin = typeof location === "undefined" ? "" : location.origin;
  return `${origin}${path}${hash ? `#${hash}` : ""}`;
}

/** Clamp an agent-supplied count into a sane range. */
export function clampLimit(value: unknown, fallback: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/** Clamp an agent-supplied character offset to a non-negative integer. */
export function clampOffset(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
