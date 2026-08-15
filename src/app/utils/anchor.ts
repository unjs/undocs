// Tests: test/app/anchor.test.ts
/**
 * Resolving a URL fragment to the heading it names.
 *
 * Client-safe and DOM-only at the point of use: `anchorId` is pure (and the part
 * under test), `findAnchor` touches `document` and is only ever called from a
 * browser-guarded path (`router.ts`'s `applyScroll`, `app.vue`'s `onMounted`
 * retry loop).
 */

/**
 * The element id a fragment names.
 *
 * `URL.hash` and `location.hash` are the SERIALIZED fragment, so a non-ASCII
 * anchor arrives percent-encoded — `#Установка` reads back as
 * `#%D0%A3%D1%81%D1%82%D0%B0%D0%BD%D0%BE%D0%B2%D0%BA%D0%B0` — while the
 * heading's `id` is the decoded text the builder slugged. Matching one against
 * the other finds nothing, which is how a docs set can have perfectly good
 * anchors and still refuse to scroll to them.
 *
 * A malformed escape (`%zz`) makes `decodeURIComponent` throw; the raw text is
 * then the best guess we have.
 */
export function anchorId(hash: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * The element a fragment points at, or `null`.
 *
 * `getElementById` first, on the decoded id: it is what the fragment actually
 * means, and it sidesteps the CSS selector grammar entirely — a hash is
 * user-authorable and need not be a valid selector (`#foo bar`, `#~<payload>`),
 * in which case `querySelector` THROWS and would take a navigation down or leak
 * a caller's interval. `querySelector` stays as the fallback, for a fragment
 * that names something other than an id.
 */
export function findAnchor(hash: string): Element | null {
  if (!hash || hash === "#") return null;
  // The raw form is the second try, for the id that literally contains a `%`.
  const el = document.getElementById(anchorId(hash)) ?? document.getElementById(hash.slice(1));
  if (el) return el;
  try {
    return document.querySelector(hash);
  } catch {
    return null;
  }
}
