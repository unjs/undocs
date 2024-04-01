// @ts-ignore
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('content:file:afterParse', (file: ContentFile) => {
    // Filter out non-markdown files
    if (!file._id?.endsWith('.md')) {
      return
    }

    transformFile(file)
    resolveFileIcon(file)

    for (const [idx, node] of (file.body?.children || []).entries()) {
      transformGithubAlert(node)
      transformStepsList(node)
      transformCodeGroups(idx, file.body?.children)
    }
  })
})

// --- transform github alerts ---

// Handle GitHub flavoured markdown blockquotes
// https://github.com/orgs/community/discussions/16925
function transformGithubAlert(node: ContentNode) {
  const firstChildValue = node.children?.[0]?.children?.[0]?.children?.[0]?.value || ''
  if (
    node.tag === 'blockquote' && // blockquote > p x 2 > span > text
    ['!NOTE', '!TIP', '!IMPORTANT', '!WARNING', '!CAUTION'].includes(firstChildValue)
  ) {
    node.type = 'element'
    node.tag = firstChildValue.slice(1).toLowerCase()
    node.children?.[0].children?.shift()
  }
}

// --- transform steps list ---

function transformStepsList(node: ContentNode) {
  // CONVERT OL->LI to Steps
  // TODO: Find a way to opt out of this transformation if needed within markdown.
  if (node.tag === 'ol' && (node.children?.length || 0) > 0 && node.children?.[0].tag === 'li') {
    const stepsChildren = node.children.map((li) => {
      const children = li.children || []

      // console.log(JSON.stringify(children, undefined, 2))

      return {
        type: 'element',
        tag: 'div',
        children,
      }
    })

    const lastLeadingSpaceOnStep = stepsChildren.map((step) => {
      let lastLeadingSpace = -1;

      for (let i = 0; i < step.children.length; i++) {
        const child = step.children[i];
        const prevChild = step.children[i - 1];
        if (
          (child?.type === 'text' && child.value?.startsWith(' ')) ||
          (prevChild?.type === 'text' && prevChild?.value?.endsWith(' '))
        ) {
          lastLeadingSpace = i;
        }
      }

      return lastLeadingSpace;
    }).filter((step) => step > -1);

    const stepsHaveContent = stepsChildren.some((step) => {
      if (lastLeadingSpaceOnStep.length > 0) {
        return step.children.slice(lastLeadingSpaceOnStep[0], lastLeadingSpaceOnStep[0]).length > 1
      }

      return step.children.length > 1
    })

    if (stepsHaveContent) {
      node.type = 'element'
      node.tag = 'Steps'
      node.props = {}
      node.children = stepsChildren
    }
  }
}

// --- transform first h1 and blockquote ---

function transformFile(file: ContentFile) {
  // Remove first h1 from markdown files as it is added to front-matter as title
  if (file.body?.children?.[0]?.tag === 'h1') {
    const text = _getTextContents(file.body.children[0].children)
    if (file.title === text) {
      file.body.children.shift()
    }
  }

  // Only use the first blockquote as the description
  const firstChild = file.body?.children?.[0]
  const firstChildText = _getTextContents(firstChild?.children)
  if (firstChild?.tag === 'blockquote' && firstChildText && !firstChildText.startsWith('!')) {
    file.description = firstChildText
    file.body?.children?.shift()
  } else {
    file.description = '' // Avoid duplication
  }
}

// --- resolve icon ---

function resolveFileIcon(file: ContentFile) {
  if (file.icon) {
    return
  }
  file.icon = _resolveIcon(file._path)
}

const _commonIcons = [
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

function _resolveIcon(path: string = '') {
  // Split the path into parts and reverse it
  const paths = path.slice(1).split('/').reverse()

  // Search for icons in reverse order
  for (const p of paths) {
    for (const icon of _commonIcons) {
      if (p.includes(icon.pattern)) {
        return icon.icon
      }
    }
  }
}

// --- transform code groups ---

function transformCodeGroups(currChildIdx: number, children: ContentNode[] = []) {
  if (!children?.length || !_isNamedCodeBlock(children[currChildIdx])) {
    return
  }

  const group: ContentNode[] = []

  for (let i = currChildIdx; i < children.length; i++) {
    const nextNode = children[i]
    if (!_isNamedCodeBlock(nextNode)) {
      break
    }
    group.push(nextNode)
    children[i] = { type: 'text', value: '' }
  }

  // Replace current children with the new code group if it has two or more code blocks
  if (group.length > 1) {
    children[currChildIdx] = {
      type: 'element',
      tag: 'CodeGroup',
      children: [...group],
    }
  }
}

function _isNamedCodeBlock(children: ContentNode): boolean {
  return children?.tag === 'pre' && children?.children?.[0]?.tag === 'code' && children?.props?.filename
}

// --- internal utils ---

function _getTextContents(children: ContentNode[] = []): string {
  return (children || [])
    .map((child) => {
      if (child.type === 'element') {
        return _getTextContents(child.children)
      }
      return child.value
    })
    .join('')
}

// --- types ---

// TODO: @nuxt/content runtimes seems both not well typed and also crashes my TS server or might be doing it wrong.

interface ContentNode {
  type?: string
  tag?: string

  children?: ContentNode[]
  props?: Record<string, any>
  value?: string
}

interface ContentFile {
  _id?: string
  _path?: string
  icon?: string
  description?: string
  title?: string
  body?: {
    children?: ContentNode[]
  }
}
