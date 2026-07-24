import { watch, type WatchSource, ref, type Ref } from "vue";
import { useColorMode } from "@app/composables/useColorMode";

const mermaidCache: Record<string, Record<string, string>> = Object.create(null);

/**
 * Lazily load the (heavy, ~client-only) mermaid library. Kept out of the main
 * chunk: `MarkdownRenderer` statically registers `Mermaid.vue`, so a top-level
 * `import mermaid from …` would ship the whole library on every page. Instead we
 * code-split it behind a dynamic import, resolved once and only when a diagram
 * actually renders (client-side — the `import.meta.server` guard below returns
 * before we ever get here on the server).
 */
let mermaidPromise: Promise<typeof import("mermaid/dist/mermaid.esm.min.mjs").default> | undefined;
const loadMermaid = () =>
  (mermaidPromise ??= import("mermaid/dist/mermaid.esm.min.mjs").then((m) => m.default));

/**
 * Resolve a CSS expression (e.g. `var(--primary)`) to a concrete color mermaid's
 * color lib (khroma) can parse. The app's design tokens are authored in `oklch`,
 * which khroma can't read, so we let the browser resolve the variable on a probe
 * element and normalize the result to sRGB (`#rrggbb`/`rgb(...)`) via a canvas.
 */
let _probe: HTMLSpanElement | undefined;
let _ctx: CanvasRenderingContext2D | undefined;
function resolveColor(expr: string): string {
  const probe = (_probe ??= document.createElement("span"));
  probe.style.color = expr;
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  // The browser may serialize the resolved token in `oklch(...)` (or another
  // Color-4 space) that khroma can't read. Rasterize a single pixel to force
  // concrete, un-premultiplied sRGB bytes, preserving alpha (e.g. dark-mode
  // `--border` is translucent white).
  const ctx = (_ctx ??= document.createElement("canvas").getContext("2d")!);
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = computed;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

/**
 * Build mermaid `base`-theme variables from the app's own design tokens so
 * diagrams match the surrounding page in both light and dark mode. Resolved
 * fresh on every render, so a color-mode switch re-derives the palette.
 */
function themeVariables(): Record<string, string> {
  return {
    background: resolveColor("var(--background)"),
    mainBkg: resolveColor("var(--muted)"),
    primaryColor: resolveColor("var(--muted)"),
    primaryTextColor: resolveColor("var(--foreground)"),
    primaryBorderColor: resolveColor("var(--primary)"),
    secondaryColor: resolveColor("var(--secondary)"),
    tertiaryColor: resolveColor("var(--accent)"),
    lineColor: resolveColor("var(--primary)"),
    textColor: resolveColor("var(--foreground)"),
    nodeBorder: resolveColor("var(--primary)"),
    clusterBkg: resolveColor("var(--card)"),
    clusterBorder: resolveColor("var(--border)"),
    titleColor: resolveColor("var(--foreground)"),
    edgeLabelBackground: resolveColor("var(--background)"),
    fontFamily: getComputedStyle(document.body).fontFamily,
    fontSize: "13px",
  };
}

export function useMermaid(source: WatchSource<string>): Ref<string | null> {
  const svg = ref<string | null>(null);
  const id = Math.random().toString(36).substring(2, 15);
  const cache = mermaidCache[id] || (mermaidCache[id] = {});
  const colorMode = useColorMode();
  watch(
    // Re-render on both content and color-mode changes; the mode is part of the
    // cache key so a switch back to a previously-rendered mode is instant.
    [source, () => colorMode.value] as const,
    async ([value, mode]) => {
      if (!source || import.meta.server) {
        svg.value = null;
        return;
      }
      const key = `${mode}:${value}`;
      if (cache[key]) {
        svg.value = cache[key];
        return;
      }
      try {
        const mermaid = await loadMermaid();
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: themeVariables(),
          // Lock the theme so a diagram's own `%%{init: {'theme': …}}%%`
          // directive can't override it. A hardcoded theme (e.g. `neutral`)
          // derives its text color from a light background, which renders as
          // near-invisible grey on our dark-mode page — flowchart labels sit in
          // filled boxes so they survive, but a sequenceDiagram's messages float
          // on the transparent background and disappear. `secure` keys are
          // stripped from directives before merge; our `initialize` palette
          // (derived from the page's design tokens, light + dark) always wins.
          secure: [
            "secure",
            "securityLevel",
            "startOnLoad",
            "maxTextSize",
            "suppressErrorRendering",
            "maxEdges",
            "theme",
            "themeVariables",
          ],
        });
        const res = await mermaid.render(`mermaid-${id}`, value);
        cache[key] = res.svg;
        svg.value = res.svg;
      } catch (error) {
        console.error("Error rendering mermaid diagram:", error);
        svg.value = `<!-- Error rendering mermaid diagram: ${error} -->`;
      }
    },
    { immediate: true },
  );
  return svg;
}
