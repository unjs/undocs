import { watch, type WatchSource } from 'vue'
import mermaid from 'mermaid/dist/mermaid.esm.min.mjs'

const mermaidCache: Record<string, Record<string, string>> = Object.create(null)

export function useMermaid(source: WatchSource<string>): Ref<string> {
  const svg = ref<string | null>(null)
  const id = Math.random().toString(36).substring(2, 15)
  const cache = mermaidCache[id] || (mermaidCache[id] = {})
  watch(
    source,
    async (value) => {
      if (!source || import.meta.server) {
        svg.value = null
        return
      }
      if (cache[value]) {
        svg.value = cache[value]
        return
      }
      try {
        const res = await mermaid.render(`mermaid-${id}`, value)
        cache[value] = res.svg
        svg.value = res.svg
      } catch (error) {
        console.error('Error rendering mermaid diagram:', error)
        svg.value = `<!-- Error rendering mermaid diagram: ${error} -->`
      }
    },
    { immediate: true },
  )
  return svg
}
