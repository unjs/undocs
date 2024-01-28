import { defineLazyEventHandler, defineEventHandler, getRequestURL } from 'h3'
import { createInstructions, preset } from '../../utils'
import { useStorage } from '#imports'

export default defineLazyEventHandler(async () => {
  const icon = await useStorage('root').getItemRaw('public:icon.svg')

  const images = await createInstructions(preset, icon)

  return defineEventHandler((event) => {
    const url = getRequestURL(event)
    return images[url.pathname].buffer()
  })
})
