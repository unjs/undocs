import { defineLazyEventHandler, setHeader, getQuery } from 'h3'
export default defineLazyEventHandler(async () => {
  // const { Resvg } = await import('@resvg/resvg-js')
  const { default: ResvgWasm } = await import('@resvg/resvg-wasm/index_bg.wasm?module' as any)
  const { Resvg, initWasm } = await import('@resvg/resvg-wasm')
  await initWasm(ResvgWasm)

  // Read server assets
  const storage = useStorage()
  // https://github.com/unjs/unstorage/issues/477
  // const fontNames = await storage.getKeys('assets:og-image:fonts:')
  const fontNames = ['200', '300', '400', '500', '600', '700', '800', '900'].flatMap((weight) => [
    `assets:og-image:fonts:nunito-latin-${weight}-normal.woff2`,
    `assets:og-image:fonts:nunito-latin-ext-${weight}-normal.woff2`,
  ])
  const fontBuffers = await Promise.all(fontNames.map((name) => storage.getItemRaw(name)))

  // Load icon
  const iconSvg: string =
    (await storage.getItem('assets:public:icon.svg')) || (await storage.getItem('assets:og-image:unjs.svg'))

  let svgTemplate = (await storage.getItem('assets:og-image:template.svg')) as string

  return defineEventHandler(async (event) => {
    if (import.meta.dev) {
      svgTemplate = (await useStorage().getItem('assets:og-image:template.svg')) as string
    }

    const { name = '', title = '', description = '' } = getQuery(event) as Record<string, string>

    const descriptionLines = _wrapLine(decodeURIComponent(description), 45)
    const titleDecoded = decodeURIComponent(title)
    const nameDecoded = decodeURIComponent(name)
    const svg = svgTemplate
      .replace('{name}', nameDecoded)
      .replace('{title}', titleDecoded)
      .replace('{titleSize}', String(titleDecoded.length > 30 ? 4 : 5))
      .replace('{description1}', descriptionLines[0] || '')
      .replace('{description2}', descriptionLines[1] || '')
      .replace('{description3}', descriptionLines[2] || '')
      .replace('{description4}', descriptionLines[3] || '')
      .replace('{icon}', updateSvg(iconSvg, { x: 1000, y: 450, width: 120, height: 120 }))

    // https://github.com/yisibl/resvg-js
    const resvg = new Resvg(svg, { font: { fontBuffers } })
    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()

    setHeader(event, 'Content-Type', 'image/png')
    return pngBuffer
  })
})

function updateSvg(svg: string, { x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  const match = svg.match(/<svg[^>]*>/)
  if (!match) return svg
  svg = svg.replace(/width="[^"]*"/, `width="${width}"`)
  svg = svg.replace(/height="[^"]*"/, `height="${height}"`)
  svg = svg.replace('<svg', `<svg x="${x}" y="${y}"`)
  return svg
}

function _wrapLine(input: string, width: number) {
  const lines: string[] = []
  let line: string = ''
  for (const word of input.split(' ')) {
    if (line.length + word.length >= width) {
      lines.push(line)
      line = ''
    }
    line += word + ' '
  }
  lines.push(line)
  return lines
}
