export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('content:file:afterParse', (file) => {
    if (file._id.endsWith('.md')) {
      // Remove first h1 and p from markdown files as they are added to front-matter by default
      if (file.body?.children?.[0]?.tag === 'h1') {
        file.body.children.shift()
      }
      // Handle GitHub flavoured markdown blockquotes
      // https://github.com/orgs/community/discussions/16925
      for (const node of (file.body?.children || [])) {
        if (node.tag === 'blockquote' && // bloquote > p x 2 > span > text
          ['!NOTE', '!TIP', '!IMPORTANT', '!WARNING', '!CAUTION'].includes(node.children?.[0]?.children?.[0]?.children?.[0]?.value)) {
            node.type = 'element'
            node.tag = node.children?.[0]?.children?.[0]?.children?.[0]?.value.slice(1).toLowerCase()
            node.children[0].children.shift()
          }
      }
    }
  })
})
