// Decode serialized fragments before ID lookup; malformed escapes fall back to raw text.
export function anchorId(hash: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// Prefer getElementById because author-provided hashes need not be valid selectors.
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
