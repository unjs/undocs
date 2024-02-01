import { getHighlighter } from 'shiki'

// Only load once.
// Since we are using a custom instance of CodeGroup and ProseCode, we need to load the highlighter here.
// It's only rendered with markdown.
const highlighter = await getHighlighter({
  themes: ['min-dark', 'min-light'],
  langs: ['shellscript'],
})

// Temporary workaround since `<ProseCode/> doesn't support highlighting` when registering component
export function useShiki() {
  const theme = useColorMode()
  const isDark = computed(() => theme.value === 'dark')

  return (code: string, lang: string) =>
    computed(() =>
      highlighter.codeToHtml(code, {
        lang,
        theme: isDark ? 'min-dark' : 'min-light',
      }),
    )
}
