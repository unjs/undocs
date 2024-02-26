export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('content:file:afterParse', (file) => {
    // Filter out non-markdown files
    if (!file._id.endsWith('.md')) {
      return
    }

    // A Set of common icons for the guide
    const commonIcons = {
      '/guide': 'ph:book-open-duotone',
      '/guide/components': 'bxs:component',
      '/config': 'ri:settings-3-line',
      '/configuration': 'ri:settings-3-line',
      '/examples': 'ph:code',
      '/utils': 'ph:function-bold'
    }

    // Set the icon for the file if it is not already set
    if (commonIcons?.[file._path] && !file.icon) {
      file.icon = commonIcons[file._path]
    }

    // Remove first h1 from markdown files as it is added to front-matter as title
    if (file.body?.children?.[0]?.tag === 'h1') {
      const text = getTextContents(file.body.children[0].children)
      if (file.title === text) {
        file.body.children.shift()
      }
    }

    // Only use the first blockquote as the description
    const firstChild = file.body.children?.[0]
    const firstChildText = getTextContents(firstChild?.children)
    if (firstChild?.tag === 'blockquote' && firstChildText && !firstChildText.startsWith('!')) {
      file.description = firstChildText
      file.body.children.shift()
    } else {
      file.description = '' // Avoid duplication
    }

    // Handle GitHub flavoured markdown blockquotes
    // https://github.com/orgs/community/discussions/16925
    for (const node of file.body?.children || []) {
      if (
        node.tag === 'blockquote' && // bloquote > p x 2 > span > text
        ['!NOTE', '!TIP', '!IMPORTANT', '!WARNING', '!CAUTION'].includes(
          node.children?.[0]?.children?.[0]?.children?.[0]?.value,
        )
      ) {
        node.type = 'element'
        node.tag = node.children?.[0]?.children?.[0]?.children?.[0]?.value.slice(1).toLowerCase()
        node.children[0].children.shift()
      }
    }
  })
})

function getTextContents(children) {
  return (children || [])
    .map((child) => {
      if (child.type === 'element') {
        return getTextContents(child.children)
      }
      return child.value
    })
    .join('')
}
