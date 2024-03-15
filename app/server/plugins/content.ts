export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('content:file:afterParse' as any, (file) => {
    // Filter out non-markdown files
    if (!file._id.endsWith('.md')) {
      return
    }

    // Set the icon for the file if it is not already set
    if (!file.icon) {
      file.icon = resolveIcon(file._path)
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
    for (const [idx, node] of (file.body?.children || []).entries()) {
      if (
        node.tag === 'blockquote' && // blockquote > p x 2 > span > text
        ['!NOTE', '!TIP', '!IMPORTANT', '!WARNING', '!CAUTION'].includes(
          node.children?.[0]?.children?.[0]?.children?.[0]?.value,
        )
      ) {
        node.type = 'element'
        node.tag = node.children?.[0]?.children?.[0]?.children?.[0]?.value.slice(1).toLowerCase()
        node.children[0].children.shift()
      }

      // CONVERT OL->LI to Steps
      // TODO: Find a way to opt out of this transformation if needed within markdown.
      if (node.tag === 'ol' && node.children.length > 0 && node.children[0].tag === 'li') {
        const stepsChildren = node.children.map((li) => {
          const label = li.children?.[0]?.value ?? undefined
          // Exclude br tags from children to avoid spacing
          const children = (label ? li.children.slice(1) : []).filter((child) => !['br'].includes(child.tag))

          return {
            type: 'element',
            tag: 'div',
            props: {
              label,
            },
            children,
          }
        })

        // For now we only check if there is at least (1) content to generate the steps..
        const stepsHaveContent = stepsChildren.some((step) => step.children.length > 0)
        if (stepsHaveContent) {
          node.type = 'element'
          node.tag = 'Steps'
          node.props = {}
          node.children = stepsChildren
        }
      }

      // Generate Code Groups
      generateCodeGroup(idx, file.body.children)
    }
  })
})

function isValidCodeBlock(children: any): boolean {
  return (
    children?.tag === 'pre' &&
    children?.children?.[0]?.tag === 'code' &&
    children?.props?.className?.includes('shiki') &&
    children?.props?.language !== 'md' // Skip markdown code blocks (they usually show examples)
  )
}

function generateCodeGroup(currChildIdx: number, children: any[]) {
  if (isValidCodeBlock(children[currChildIdx])) {
    const group = new Map<number, Record<any, any>>()

    for (let i = currChildIdx; i < children.length; i++) {
      const nextNode = children[i]
      if (!isValidCodeBlock(nextNode)) {
        break
      }
      group.set(i, nextNode)
      children[i] = { type: 'text', value: '' }
    }

    // Replace current children with the new code group if it has two or more code blocks
    if (group.size >= 2) {
      children[currChildIdx] = {
        type: 'element',
        tag: 'CodeGroup',
        children: [...group.values()],
      }
    }
  }
}

function getTextContents(children: any[]): string {
  return (children || [])
    .map((child) => {
      if (child.type === 'element') {
        return getTextContents(child.children)
      }
      return child.value
    })
    .join('')
}

// A set of common icons
const commonIcons = [
  {
    pattern: 'guide',
    icon: 'ph:book-open-duotone',
  },
  {
    pattern: 'components',
    icon: 'bxs:component',
  },
  {
    pattern: 'config',
    icon: 'ri:settings-3-line',
  },
  {
    pattern: 'configuration',
    icon: 'ri:settings-3-line',
  },
  {
    pattern: 'examples',
    icon: 'ph:code',
  },
  {
    pattern: 'utils',
    icon: 'ph:function-bold',
  },
]

function resolveIcon(path: string) {
  // Split the path into parts and reverse it
  const paths = path.slice(1).split('/').reverse()

  // Search for icons in reverse order
  for (const p of paths) {
    for (const icon of commonIcons) {
      if (p.includes(icon.pattern)) {
        return icon.icon
      }
    }
  }
}
