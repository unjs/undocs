import { defineLazyEventHandler, setHeader, getQuery } from "h3";
import { render } from "takumi-js";
import { container, image, text } from "takumi-js/helpers";

const themeColorMap = {
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
  const storage = useStorage();

  const iconSvg: string =
    (await storage.getItem("assets:public:icon.svg")) ||
    (await storage.getItem("assets:og-image:unjs.svg"));

  // Load fonts once at startup from bundled assets and reuse them across requests.
  // Kept local (no Google Fonts fetch) so rendering never depends on the network.
  const loadFont = async (file: string, weight: number) => {
    const data = (await storage.getItemRaw(`assets:og-image:fonts:${file}`)) as
      | Uint8Array
      | Buffer
      | null;
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
    const { name = "", title = "", description = "" } = getQuery(event) as Record<string, string>;

    const docsConfig = useAppConfig().docs;
    const themeColor = docsConfig.themeColor || "yellow";
    const themeColorValue = themeColorMap[themeColor] || themeColor;

    const decoded = {
      name: decodeURIComponent(name),
      title: decodeURIComponent(title),
      description: decodeURIComponent(description),
    };

    const png = await render(template({ ...decoded, themeColor: themeColorValue, icon: iconSvg }), {
      width: 1200,
      height: 630,
      format: "png",
      fonts,
    });

    setHeader(event, "Content-Type", "image/png");
    return Buffer.from(png);
  });
});

// Append an alpha channel to a `#rrggbb` color; pass other color strings through untouched.
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
      // Crisp inner frame so the card reads as a deliberate surface, not a raw crop.
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
    },
    children: [
      // Primary theme glow, anchored off the top-right corner.
      container({
        style: {
          position: "absolute",
          inset: 0,
          opacity: 0.5,
          backgroundImage: `radial-gradient(900px 620px at 960px -160px, ${themeColor} 0%, transparent 62%)`,
        },
        children: [],
      }),
      // Faint tech grid, masked to fade out toward the bottom-left so it stays subtle.
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
      // Branded top accent hairline.
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
      // Kicker: theme dot + package/section name.
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
      // Title — shrink to a single line so long titles never overflow.
      // NOTE: no `letterSpacing` here; it defeats takumi's `textFit` measurement
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
      // Soft glow behind the brand mark.
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
