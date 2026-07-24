// Tests: test/content/icons.test.ts
export const CommonIcons: { pattern: string; icon: string }[] = [
  { pattern: "guide", icon: "i-lucide-book-open" },
  { pattern: "components", icon: "i-lucide-component" },
  { pattern: "config", icon: "i-lucide-settings" },
  { pattern: "configuration", icon: "i-lucide-settings" },
  { pattern: "examples", icon: "i-lucide-code" },
  { pattern: "utils", icon: "i-lucide-square-function" },
  { pattern: "blog", icon: "i-lucide-file-text" },
];

/** Infer a navigation icon from a route path */
export function resolveIcon(path = ""): string | undefined {
  const paths = path
    .slice(1)
    .split("/")
    .reverse()
    .filter((p) => p && !p.startsWith("."));
  if (paths.length > 2) return undefined;
  for (const p of paths) {
    for (const icon of CommonIcons) {
      if (p.includes(icon.pattern)) return icon.icon;
    }
  }
  return undefined;
}
