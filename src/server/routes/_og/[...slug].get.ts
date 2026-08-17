import { defineLazyEventHandler, defineEventHandler, getRouterParam, HTTPError } from "nitro/h3";
import { useStorage } from "nitro/storage";
import { useRuntimeConfig } from "nitro/runtime-config";
import { withLeadingSlash } from "ufo";
import { render } from "takumi-js";
import { container, image, text } from "takumi-js/helpers";
import { getIndex } from "../../content/store.ts";

// Cards are always dark, so map names to dark-mode accents; neutral spellings
// must resolve to the site's foreground rather than CSS mid-grey.
const themeColorMap: Record<string, string> = {
  mono: "#ededed",
  monochrome: "#ededed",
  gray: "#ededed",
  grey: "#ededed",
  slate: "#ededed",
  zinc: "#ededed",
  neutral: "#ededed",
  stone: "#ededed",
  red: "#ff6467",
  orange: "#ff8904",
  amber: "#ffb900",
  yellow: "#fdc700",
  lime: "#9ae600",
  green: "#05df72",
  emerald: "#00d492",
  teal: "#00d5be",
  cyan: "#00d3f2",
  sky: "#00bcff",
  blue: "#50a2ff",
  indigo: "#7c86ff",
  violet: "#a684ff",
  purple: "#c27aff",
  fuchsia: "#ed6aff",
  pink: "#fb64b6",
  rose: "#ff637e",
};

export default defineLazyEventHandler(async () => {
  // Icon precedence: docs override, app default, bundled UnJS fallback.
  const ogImage = useStorage("assets/og-image");
  const publicAssets = useStorage("assets/og-public");
  const docsPublic = useStorage("assets/og-docs");

  const iconSvg =
    (await docsPublic.getItem<string>("icon.svg").catch(() => null)) ||
    (await publicAssets.getItem<string>("icon.svg").catch(() => null)) ||
    (await ogImage.getItem<string>("unjs.svg")) ||
    "";

  // Lazy handler caches bundled fonts without a network dependency.
  const loadFont = async (file: string, weight: number) => {
    const data = (await ogImage.getItemRaw(`fonts/${file}`)) as Uint8Array | Buffer | null;
    if (!data) {
      throw new Error(`[og-image] missing bundled font asset: fonts/${file}`);
    }
    return { name: "Public Sans", weight, data };
  };

  const fonts = await Promise.all([
    loadFont("public-sans-400.ttf", 400),
    loadFont("public-sans-700.ttf", 700),
  ]);

  return defineEventHandler(async (event) => {
    // Trust indexed page metadata, not query input; `_index` uses site metadata.
    const slug =
      getRouterParam(event, "slug") ||
      decodeURIComponent(event.url.pathname).replace(/^\/_og\//, "");
    if (!slug.endsWith(".png")) {
      throw new HTTPError({ status: 404, statusText: "Not found" });
    }

    const undocs = useRuntimeConfig().undocs || {};
    const siteName = (undocs.name as string) || "";
    const siteDescription = (undocs.description as string) || "";

    let title = siteName;
    let description = siteDescription;

    const raw = slug.replace(/\.png$/, "");
    if (raw !== "_index") {
      const path = withLeadingSlash(raw);
      const index = await getIndex();
      const page = index.byPath.get(path) || index.byPath.get(path + "/");
      if (!page) {
        throw new HTTPError({ status: 404, statusText: "Page not found", message: path });
      }
      title = page.title || siteName;
      description = page.description || siteDescription;
    }

    const themeColor = (undocs.themeColor as string) || "mono";
    // Match names case-insensitively; preserve custom CSS colors verbatim.
    const themeColorValue = themeColorMap[themeColor.toLowerCase()] || themeColor;

    const meta = { name: siteName, title, description };

    const png = await render(template({ ...meta, themeColor: themeColorValue, icon: iconSvg }), {
      width: 1200,
      height: 630,
      format: "png",
      fonts,
    });

    event.res.headers.set("Content-Type", "image/png");
    return Buffer.from(png);
  });
});

function withAlpha(color: string, alpha: number) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${color}${a}`;
}

function template({
  name,
  title,
  description,
  themeColor,
  icon,
}: {
  name: string;
  title: string;
  description: string;
  themeColor: string;
  icon: string;
}) {
  return container({
    style: {
      position: "relative",
      width: 1200,
      height: 630,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: "80px 90px",
      backgroundColor: "#0a0a0a",
      color: "white",
      fontFamily: "Public Sans",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
    },
    children: [
      container({
        style: {
          position: "absolute",
          inset: 0,
          opacity: 0.5,
          backgroundImage: `radial-gradient(900px 620px at 960px -160px, ${themeColor} 0%, transparent 62%)`,
        },
        children: [],
      }),
      container({
        style: {
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 52px), repeating-linear-gradient(90deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 52px)",
          maskImage: "radial-gradient(120% 120% at 82% 0%, #000 25%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(120% 120% at 82% 0%, #000 25%, transparent 72%)",
        },
        children: [],
      }),
      container({
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          backgroundImage: `linear-gradient(to right, ${themeColor} 0%, ${withAlpha(themeColor, 0.15)} 45%, transparent 75%)`,
        },
        children: [],
      }),
      ...(name
        ? [
            container({
              style: {
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 18,
                marginBottom: 26,
              },
              children: [
                container({
                  style: {
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    backgroundColor: themeColor,
                    boxShadow: `0 0 22px ${themeColor}`,
                  },
                  children: [],
                }),
                text(name, {
                  fontSize: 34,
                  fontWeight: 700,
                  color: themeColor,
                  letterSpacing: 0.5,
                }),
              ],
            }),
          ]
        : []),
      // No `letterSpacing`: it defeats takumi's `textFit` measurement
      // and lets long titles overflow the frame.
      text(title, {
        fontSize: 84,
        fontWeight: 700,
        lineHeight: 1.05,
        width: 1020,
        whiteSpace: "nowrap",
        textFit: "shrink",
      }),
      ...(description
        ? [
            text(description, {
              fontSize: 34,
              fontWeight: 400,
              lineHeight: 1.42,
              marginTop: 28,
              maxWidth: 820,
              color: "#a1a1aa",
            }),
          ]
        : []),
      container({
        style: {
          position: "absolute",
          right: 60,
          bottom: 44,
          width: 160,
          height: 160,
          opacity: 0.55,
          backgroundImage: `radial-gradient(closest-side, ${themeColor} 0%, transparent 70%)`,
        },
        children: [],
      }),
      image({
        src: icon,
        width: 120,
        height: 120,
        style: { position: "absolute", right: 80, bottom: 64 },
      }),
    ],
  });
}
