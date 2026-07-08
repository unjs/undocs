import { defineLazyEventHandler, setHeader, getQuery } from "h3";
import { render } from "takumi-js";
import { container, image, text, googleFonts } from "takumi-js/helpers";

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

  // Load fonts once at startup and reuse them across requests.
  const fonts = await googleFonts({
    families: [
      { name: "Public Sans", weight: [400, 700] },
      { name: "Noto Sans TC", weight: [400, 700] },
    ],
  });

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
      height: 600,
      format: "png",
      fonts,
    });

    setHeader(event, "Content-Type", "image/png");
    return Buffer.from(png);
  });
});

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
      height: 600,
      display: "flex",
      flexDirection: "column",
      padding: "90px 85px",
      backgroundColor: "#181818",
      color: "white",
      fontFamily: "Public Sans",
    },
    children: [
      container({
        style: {
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(600px 600px at 600px -180px, ${themeColor} 0%, transparent 70%)`,
        },
        children: [],
      }),
      text(name, { fontSize: 72, fontWeight: 700, color: themeColor }),
      // Takumi has no `text-fit` support, so scale the title down for long titles to avoid overflow.
      text(title, {
        fontSize: title.length > 45 ? 52 : title.length > 30 ? 64 : 80,
        fontWeight: 700,
        marginTop: 16,
        maxWidth: 1030,
      }),
      text(description, {
        fontSize: 36,
        fontWeight: 400,
        lineHeight: 1.4,
        marginTop: 40,
        maxWidth: 880,
      }),
      image({
        src: icon,
        width: 120,
        height: 120,
        style: { position: "absolute", right: 85, bottom: 60 },
      }),
    ],
  });
}
