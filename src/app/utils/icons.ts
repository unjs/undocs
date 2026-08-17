/**
 * Icon-name plumbing shared by `Icon.vue` and the blocks that decide how to
 * PAINT an icon before Iconify has resolved it.
 */

// Iconify collections whose name itself contains a dash — the first-dash split
// would otherwise mangle them (e.g. `simple-icons-github` -> `simple:...`).
const MULTIWORD_COLLECTIONS = [
  "simple-icons",
  "vscode-icons",
  "flat-color-icons",
  "file-icons",
  "line-md",
  "material-symbols",
  "skill-icons",
  "devicon-plain",
  "fluent-emoji",
  "fluent-emoji-flat",
  "fluent-emoji-high-contrast",
];

/**
 * Normalizes the name syntaxes used across the codebase (and user docs configs)
 * into Iconify's `collection:name` form. A leading `i-` (the UnoCSS-preset
 * convention) is stripped first, then:
 *
 *   - Colon form:  `simple-icons:markdown` / `i-simple-icons:markdown`
 *                  / `vscode-icons:file-type-node`  -> `collection:name` as-is.
 *   - Dash form:   `i-lucide-arrow-right`   -> `lucide:arrow-right`
 *                  `i-simple-icons-github`  -> `simple-icons:github`
 *     Rule: the FIRST dash separates collection from icon name — EXCEPT for
 *     the multi-word collections above, which are matched by prefix first.
 *
 * Any multi-word collection not listed should be written in colon form.
 */
export function normalizeIconName(name?: string): string {
  let n = name;
  if (!n) return "";
  // Strip the UnoCSS-preset `i-` prefix first, so `i-simple-icons:markdown`
  // reduces to a clean `collection:name`.
  if (n.startsWith("i-")) n = n.slice(2);
  if (n.includes(":")) return n; // already `collection:name`
  // Dash form: honor multi-word collection names before the first-dash split.
  for (const c of MULTIWORD_COLLECTIONS) {
    if (n.startsWith(`${c}-`)) return `${c}:${n.slice(c.length + 1)}`;
  }
  const dash = n.indexOf("-");
  if (dash === -1) return n;
  return `${n.slice(0, dash)}:${n.slice(dash + 1)}`;
}

// Collections that ship their own colours. Everything else paints in
// `currentColor`, which is how a feature icon inherits `--brand`.
const COLORED_COLLECTIONS = new Set([
  "logos",
  "devicon",
  "vscode-icons",
  "flat-color-icons",
  "skill-icons",
  "catppuccin",
  "material-icon-theme",
  "twemoji",
  "noto",
  "noto-v1",
  "openmoji",
  "emojione",
  "fxemoji",
  "fluent-emoji",
  "fluent-emoji-flat",
  "circle-flags",
  "flag",
  "flagpack",
  "cif",
]);

/** Matches the loose emoji test the icon-rendering blocks share. */
export function isEmojiIcon(icon?: string): boolean {
  return Boolean(icon && /\p{Emoji}/u.test(icon));
}

/**
 * Whether an icon carries colour OF ITS OWN — an emoji, or an Iconify set that
 * paints in fixed colours. This is what a `grayscale` filter may be applied to:
 * a `currentColor` icon has no colour to desaturate, only the `--brand` it
 * inherited, and greying that out would drop the accent the icon is there to
 * carry.
 */
export function isColoredIcon(icon?: string): boolean {
  if (!icon) return false;
  if (isEmojiIcon(icon)) return true;
  const normalized = normalizeIconName(icon);
  const colon = normalized.indexOf(":");
  return colon !== -1 && COLORED_COLLECTIONS.has(normalized.slice(0, colon));
}
