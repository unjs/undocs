/**
 * `localStorage` that cannot throw.
 *
 * Every accessor throws a `SecurityError` when storage is blocked (private mode
 * in some browsers, blocked cookies, a sandboxed iframe). The callers here run
 * at bootstrap or in a component's setup, so an unguarded read stops the app
 * from mounting at all. A visitor without storage gets the defaults and keeps
 * no choice across loads, the same way the inline `<head>` programs degrade.
 */

/** The stored value, or `null` when there is none or storage is blocked. */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Store `value`, or remove the key on `null`. A no-op when storage is blocked. */
export function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Blocked: the choice lasts for this page load only.
  }
}
