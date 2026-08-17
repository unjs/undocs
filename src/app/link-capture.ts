/**
 * Take over same-origin `<a>` clicks the app did not render itself.
 *
 * `AppLink` routes every link the app renders, but it is not the only source of
 * anchors on a docs page:
 *
 *   - **Raw HTML in markdown.** `liftRawHtml` (`server/content/transforms.ts`)
 *     hands author markup to the client as `_html` nodes injected with `v-html`,
 *     so an `<a href="/guide/x">` written inside a `<div>` is a plain anchor Vue
 *     never sees as a component — clicking it reloads the whole site.
 *   - **Anything a third-party script injects** (an embed, a widget, a banner).
 *
 * One delegated listener on `document` turns both into router navigations. It
 * listens in the BUBBLE phase on purpose: by then anything that wanted the click
 * for itself has run, and either called `preventDefault` (we skip the event) or
 * stopped propagation (we never see it) — both of which read as "somebody else
 * owns this click". Capture phase would preempt them, `AppLink` included.
 *
 * What this deliberately does NOT intercept: `history.pushState` (a foreign
 * script pushing state is usually tracking its OWN state, not navigating, and
 * hijacking that fights the script) and `location.href = …` (unpatchable —
 * `Location`'s members are `[LegacyUnforgeable]`, i.e. non-configurable own
 * properties, so they cannot be redefined). Catching a scripted location
 * assignment needs the Navigation API's `navigate` event, which is a separate,
 * feature-detected layer.
 *
 * Installed from `main.ts`, so the module only ever runs in the browser. The
 * pure decisions below are exported separately because vitest runs in `node`:
 * they are typed structurally, against exactly the properties they read.
 */
import type { AppRouter } from "@app/router.ts";
import { isAppRoute } from "@app/utils/routes.ts";

/** The parts of a `MouseEvent` that decide whether a click is ours to handle. */
export interface ClickLike {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * An unmodified primary-button click nobody has handled yet. A modifier or a
 * middle click is the visitor asking the BROWSER for something (new tab, new
 * window, download, paste-and-go) — never a route change. Shared with `AppLink`
 * so an authored link and a foreign one cannot disagree about what a click is.
 */
export function isPlainLinkClick(event: ClickLike): boolean {
  if (event.defaultPrevented || event.button !== 0) {
    return false;
  }
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

/** The parts of an `HTMLAnchorElement` that decide where a click leads. */
export interface AnchorLike {
  /** The RESOLVED absolute URL — not the attribute. */
  href: string;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  target: string;
  relList: { contains(token: string): boolean };
}

/**
 * The in-app navigation target for a click on `anchor`, or `null` when the
 * browser should keep the click.
 *
 * Both forms of the href are read, and the difference matters: the ATTRIBUTE
 * says what the author meant (a bare `#anchor` is a scroll, not a navigation),
 * while `.href` is the browser's own resolution of it — which is what makes a
 * relative href inside raw HTML resolve against the current page exactly as the
 * browser would have.
 */
export function anchorTarget(anchor: AnchorLike, origin: string): string | null {
  const href = anchor.getAttribute("href");
  // No href is not a link. A bare fragment is the browser's job — it scrolls
  // natively, and `AppLink` hands `#x` targets over the same way.
  if (!href || href.startsWith("#")) {
    return null;
  }
  // `download` and a foreign `target` both mean "not a same-tab navigation";
  // `rel="external"` is the author's explicit opt-out.
  if (anchor.hasAttribute("download")) {
    return null;
  }
  if (anchor.target && anchor.target !== "_self") {
    return null;
  }
  if (anchor.relList.contains("external")) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(anchor.href);
  } catch {
    return null;
  }
  // Off-site, or a non-fetch scheme (`mailto:`/`tel:`/`javascript:` all resolve
  // to the opaque `"null"` origin, so this covers them too).
  if (url.origin !== origin) {
    return null;
  }
  if (!isAppRoute(url.pathname)) {
    return null;
  }
  return url.pathname + url.search + url.hash;
}

/** The anchor a click landed in, crossing open shadow boundaries. */
function closestAnchor(event: MouseEvent): HTMLAnchorElement | null {
  // `composedPath()` is the event's ancestor chain, so the FIRST anchor in it is
  // the closest one. An `<a>` inside an SVG is an `SVGAElement` instead, whose
  // `href` is an `SVGAnimatedString` rather than a URL string — left to the
  // browser.
  for (const node of event.composedPath()) {
    if (node instanceof HTMLAnchorElement) {
      return node;
    }
  }
  return null;
}

/**
 * Start routing foreign same-origin anchors through `router`. Idempotent per
 * signal; pass an `AbortSignal` to tear the listener down again (an HMR
 * re-install, a test).
 */
export function installLinkCapture(router: AppRouter, signal?: AbortSignal): void {
  document.addEventListener(
    "click",
    (event: MouseEvent) => {
      if (!isPlainLinkClick(event)) {
        return;
      }
      const anchor = closestAnchor(event);
      if (!anchor) {
        return;
      }
      const target = anchorTarget(anchor, location.origin);
      if (target === null) {
        return;
      }
      event.preventDefault();
      void router.push(target);
    },
    { signal },
  );
}
