import { type Preset } from '@vite-pwa/assets-generator/config'
import { instructions } from '@vite-pwa/assets-generator/api/instructions'
import { minimal2023Preset } from '@vite-pwa/assets-generator/presets'

export const preset: Preset = {
    ...minimal2023Preset,
    assetName: (type, size) => {
  switch (type) {
    case 'transparent': {
      return `icon-${size.width}x${size.height}.png`
    }
    case 'maskable': {
      return `maskable-icon-${size.width}x${size.height}.png`
    }
    case 'apple': {
      return `apple-touch-icon-${size.width}x${size.height}.png`
    }
    }
  }
}

export async function createInstructions(preset: Preset, data: Buffer = Buffer.from('')) {
  const items = await instructions({
      imageResolver: () => data,
      imageName: '',
      preset,
      htmlLinks: { xhtml: false, includeId: false },
      basePath: '/',
      resolveSvgName: () => '',
  })

  return {
    ...items.favicon,
    // ...items.transparent, // Only for PWA
    // ...items.maskable, // Only for PWA
    ...items.apple
  }
}
