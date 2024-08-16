import { useRuntimeConfig } from '#imports'

Object.defineProperty(globalThis, '__undocs__', {
  get() {
    return useRuntimeConfig().__undocs__ || { docsConfig: {} }
  },
})

export default () => {
  // noop
}
