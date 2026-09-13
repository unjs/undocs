/**
 * The cookies the reader's choices about the chat are kept in.
 *
 * Cookies rather than `localStorage` because these things are about the SITE
 * rather than about the chat: what the chat itself stores — the provider, the
 * key and the conversations — is the session's own store.
 *
 * Read and written on mount alone, never during a render, so the server is never
 * asked about a reader it is rendering one of many requests for.
 */

/** Half a year. Long enough that the site is found as the reader left it. */
const MAX_AGE = 60 * 60 * 24 * 180;

export function readCookie(name: string): string | undefined {
  const pair = document.cookie.split("; ").find((entry) => entry.startsWith(`${name}=`));
  return pair?.slice(name.length + 1);
}

export function writeCookie(name: string, value: string): void {
  // `lax` because nothing here follows a cross-site request, and `secure` off a
  // plain-http `localhost`, which is where a docs site is developed.
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${name}=${value}; path=/; max-age=${MAX_AGE}; samesite=lax${secure}`;
}
