import { defineLazyEventHandler, setHeader, getQuery } from "h3";

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
  // const { Resvg } = await import('@resvg/resvg-js')
  const { default: ResvgWasm } = await import("@resvg/resvg-wasm/index_bg.wasm?module" as any);
  const { Resvg, initWasm } = await import("@resvg/resvg-wasm");
  await initWasm(ResvgWasm);

  // Read server assets
  const storage = useStorage();
  // https://github.com/unjs/unstorage/issues/477
  // const fontNames = await storage.getKeys('assets:og-image:fonts:')
  const fontNames = ["Black", "Bold", "ExtraLight", "Light", "Medium", "Regular", "Thin"].flatMap(
    (v) => [`assets:og-image:fonts:PublicSans-${v}.woff2`],
  );
  const fontBuffers = await Promise.all(fontNames.map((name) => storage.getItemRaw(name)));

  // Load icon
  const iconSvg: string =
    (await storage.getItem("assets:public:icon.svg")) ||
    (await storage.getItem("assets:og-image:unjs.svg"));

  let svgTemplate = (await storage.getItem("assets:og-image:template.svg")) as string;

  return defineEventHandler(async (event) => {
    if (import.meta.dev) {
      svgTemplate = (await useStorage().getItem("assets:og-image:template.svg")) as string;
    }

    const { name = "", title = "", description = "" } = getQuery(event) as Record<string, string>;

    const docsConfig = useAppConfig().docs;
    const themeColor = docsConfig.themeColor || "yellow";
    const themeColorValue = themeColorMap[themeColor] || themeColor;

    const descriptionLines = _wrapLine(decodeURIComponent(description), 55);
    const titleDecoded = decodeURIComponent(title);
    const nameDecoded = decodeURIComponent(name);
    const svg = svgTemplate
      .replace("{name}", nameDecoded)
      .replace("{title}", titleDecoded)
      .replace("{titleSize}", String(titleDecoded.length > 30 ? 4 : 5))
      .replace("{description1}", descriptionLines[0] || "")
      .replace("{description2}", descriptionLines[1] || "")
      .replace("{description3}", descriptionLines[2] || "")
      .replace("{description4}", descriptionLines[3] || "")
      .replace(/yellow/g, themeColorValue)
      .replace("{icon}", updateSvg(iconSvg, { x: 1000, y: 450, width: 120, height: 120 }));

    // https://github.com/yisibl/resvg-js
    const resvg = new Resvg(svg, { font: { fontBuffers } });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    setHeader(event, "Content-Type", "image/png");
    return pngBuffer;
  });
});

function updateSvg(
  svg: string,
  { x, y, width, height }: { x: number; y: number; width: number; height: number },
) {
  const match = svg.match(/<svg[^>]*>/);
  if (!match) return svg;
  svg = svg.replace(/width="[^"]*"/, `width="${width}"`);
  svg = svg.replace(/height="[^"]*"/, `height="${height}"`);
  svg = svg.replace("<svg", `<svg x="${x}" y="${y}"`);
  return svg;
}

function _wrapLine(input: string, width: number) {
  const lines: string[] = [];
  let line: string = "";
  for (const word of input.split(" ")) {
    if (line.length + word.length >= width) {
      lines.push(line);
      line = "";
    }
    line += word + " ";
  }
  lines.push(line);
  return lines;
}
