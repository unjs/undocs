export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('content:file:afterParse', (file) => {
    if (file._id.endsWith('.md')) {
      // Remove first h1 and p from markdown files as they are added to front-matter by default
      if (file.body?.children?.[0]?.tag === 'h1') {
        file.body.children.shift()
      }
      if (file.body?.children?.[0]?.tag === 'p') {
        file.body.children.shift()
      }
    }
  })
})
