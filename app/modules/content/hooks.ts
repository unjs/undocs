import type { MarkdownRoot, MinimalNode, MinimalElement } from '@nuxt/content'
import type { Nuxt } from 'nuxt/schema'
import { CommonIcons } from './icons'
import type { DocsConfig } from '../../../schema/config'
import { pathToFileURL } from 'node:url'
import { writeFile } from 'node:fs/promises'

interface ParsedContentFile extends Record<string, unknown> {
  path?: string
  navigation?: {
    icon?: string
  }
}

export async function setupContentHooks(nuxt: Nuxt, docsConfig: DocsConfig) {
  let automdTransform: (content: string, path: string) => string | Promise<string> | undefined
  if (docsConfig.automd) {
    const automd = await import('automd')
    const config = await automd.loadConfig(docsConfig.dir, docsConfig.automd)
    automdTransform = async (content: string, path: string) => {
      const res = await automd.transform(content, config, pathToFileURL(path).href)
      if (!res.hasIssues) {
        if (res.hasChanged) {
          console.info(`[undocs] [automd] Updated \`${path}\` with automd transform, saving changes...`)
          await writeFile(path, res.contents, 'utf-8')
        }
        return res.contents
      }
      console.warn(
        `[undocs] [automd] Issues for updating \`${path}\`:`,
        res.updates
          .flatMap((u) => u.result.issues)
          .map((i) => `\n  - ${i}`)
          .join('\n'),
      )
      return content
    }
  }

  nuxt.hooks.hook('content:file:beforeParse', async ({ file }) => {
    if (typeof file.body !== 'string') {
      return // can be json meta
    }
    if (file.body.includes('<!-- automd:')) {
      // Transform
      if (automdTransform) {
        file.body = await automdTransform(file.body, file.path)
      }
      // Add meta (for rendering contribution hint)
      if (file.body.startsWith('---')) {
        file.body = file.body.replace('---', '---\nautomd: true\n')
      } else {
        file.body = `---\nautomd: true\n---\n${file.body}`
      }
    }
  })

  nuxt.hooks.hook('content:file:afterParse', ({ content }) => {
    // Filter out non-markdown files
    if (content.extension !== 'md') {
      return
    }

    resolveFileIcon(content)

    const body = content.body as MarkdownRoot
    removeFirstH1AndBlockquote(body, content)
    for (const node of body.value) {
      if (typeof node === 'string') {
        continue
      }
      transformGithubAlert(node)
      transformStepsList(node)
      // transformCodeGroups(idx, body.value)
      // transformJSDocs(idx, file.body?.children)
    }
  })
}

// --- transform github alerts ---

// Handle GitHub flavoured markdown blockquotes
// https://github.com/orgs/community/discussions/16925
function transformGithubAlert(node: MinimalNode) {
  if (
    node[0] === 'blockquote' &&
    Array.isArray(node[2]) &&
    node[2][0] === 'p' &&
    Array.isArray(node[2][2]) &&
    node[2][2][0] === 'span' &&
    typeof node[2][2][2] === 'string' &&
    ['!NOTE', '!TIP', '!IMPORTANT', '!WARNING', '!CAUTION'].includes(node[2][2][2])
  ) {
    // @ts-ignore - ignore type error for now
    node[0] = node[2][2][2].slice(1).toLowerCase()
    node[2][2].shift()
  }
}

// --- transform steps list ---
function transformStepsList(node: MinimalNode) {
  // CONVERT OL->LI to Steps
  if (Array.isArray(node) && node[0] === 'ol' && node.length > 3 && Array.isArray(node[2]) && node[2][0] === 'li') {
    const stepsChildren = node.slice(2).map((li: MinimalNode) => {
      return ['h4', {}, ...li.slice(2)] as MinimalElement
    })
    // console.log('stepsChildren', stepsChildren)
    node.splice(0, Infinity, 'steps', { level: '4' }, ...stepsChildren)
    // console.log(node)
  }

  // CONVERT OL->LI to Steps
  // TODO: Find a way to opt out of this transformation if needed within markdown.
  // if (node.tag === 'ol' && (node.children?.length || 0) > 0 && node.children?.[0].tag === 'li') {
  //   const stepsChildren = node.children.map((li) => {
  //     const children = li.children || []

  //     // console.log(JSON.stringify(children, undefined, 2))

  //     return {
  //       type: 'element',
  //       tag: 'div',
  //       children,
  //     }
  //   })

  //   const lastLeadingSpaceOnStep = stepsChildren
  //     .map((step) => {
  //       let lastLeadingSpace = -1

  //       for (let i = 0; i < step.children.length; i++) {
  //         const child = step.children[i]
  //         const prevChild = step.children[i - 1]
  //         if (
  //           (child?.type === 'text' && child.value?.startsWith(' ')) ||
  //           (prevChild?.type === 'text' && prevChild?.value?.endsWith(' '))
  //         ) {
  //           lastLeadingSpace = i
  //         }
  //       }

  //       return lastLeadingSpace
  //     })
  //     .filter((step) => step > -1)

  //   const stepsHaveContent = stepsChildren.some((step) => {
  //     if (lastLeadingSpaceOnStep.length > 0) {
  //       return step.children.slice(lastLeadingSpaceOnStep[0], lastLeadingSpaceOnStep[0]).length > 1
  //     }

  //     return step.children.length > 1
  //   })

  //   if (stepsHaveContent) {
  //     node.type = 'element'
  //     node.tag = 'Steps'
  //     node.props = {}
  //     node.children = stepsChildren
  //   }
  // }
}

// --- transform first h1 and blockquote ---

function removeFirstH1AndBlockquote(body: MarkdownRoot, content: ParsedContentFile) {
  // Remove first h1 from markdown files as it is added to front-matter as title
  if (body.value?.[0]?.[0] === 'h1' && content.title === _getTextContent(body.value[0])) {
    body.value.shift()
  }

  // Remove default inferred value for description
  content.description = ''
  if (content.seo) {
    ;(content.seo as any).description = ''
  }

  // Use the first blockquote as the description
  const firstEl = body.value[0]
  const bloquoteText = _getTextContent(firstEl)

  if (firstEl[0] === 'blockquote' && content.description === '' && !bloquoteText.startsWith('!')) {
    content.description = bloquoteText
    if (content.seo) {
      ;(content.seo as any).description = bloquoteText
    }
    body.value.shift()
  }
}

// --- resolve icon ---

function resolveFileIcon(content: ParsedContentFile) {
  if (content.navigation?.icon) {
    return
  }
  content.navigation ||= {}
  content.navigation.icon = _resolveIcon(content.path)
}

function _resolveIcon(path: string = '') {
  // Split the path into parts and reverse it
  const paths = path.slice(1).split('/').reverse()

  // Search for icons in reverse order
  for (const p of paths) {
    for (const icon of CommonIcons) {
      if (p.includes(icon.pattern)) {
        return icon.icon
      }
    }
  }
}

// --- transform code groups ---

function transformCodeGroups(currChildIdx: number, children: MinimalNode[] = []) {
  if (!children?.length || !_isNamedCodeBlock(children[currChildIdx])) {
    return
  }

  const group: {
    idx: number
    node: MinimalNode
  }[] = []

  for (let i = currChildIdx; i < children.length; i++) {
    const nextNode = children[i]
    if (!_isNamedCodeBlock(nextNode)) {
      break
    }
    group.push({ idx: i, node: nextNode })
  }

  // Replace current children with the new code group if it has two or more code blocks
  if (group.length > 1) {
    // Only  reset children if we have more than one code block
    // Code here is to avoid empty text nodes in the markdown AST
    for (const { idx } of group) {
      children[idx] = { type: 'text', value: '' }
    }

    children[currChildIdx] = {
      type: 'element',
      tag: 'CodeGroup',
      children: group.map((g) => g.node),
    }
  }
}

function _isNamedCodeBlock(children: MinimalNode): boolean {
  return children?.tag === 'pre' && children?.children?.[0]?.tag === 'code' && children?.props?.filename
}

// --- transform automd jsdocs ---

export function transformJSDocs(currChildIdx: number, children: MinimalNode[] = []) {
  if (!children?.length || !_isJSDocBlock(children[currChildIdx])) {
    return
  }

  const fields: MinimalNode[] = []

  const generateFields = (i: number): MinimalNode => {
    const name = _parseJSDocName(children[i])
    const type = _parseJSDocType(children[i + 1])

    const props: {
      name: string
      type: string | false
    } = {
      name,
      type,
    }

    const content: MinimalNode[] = []

    i++

    if (type !== '') {
      children[i] = _emptyASTNode()
      i++
    }

    while (i < children.length && children[i].tag !== 'h3' && children[i].tag === 'p') {
      content.push(children[i])
      children[i] = _emptyASTNode()
      i++
    }

    return {
      type: 'element',
      tag: 'field',
      props,
      children: content,
    }
  }

  // Go through we find the correct match for all h3
  for (let i = currChildIdx; i < children.length; i++) {
    // Make sure it's a JSDoc block before generating fields
    if (_isJSDocBlock(children[i])) {
      const field = generateFields(i)
      // Double check if has description or a type to avoid empty fields
      if ((field?.children || [])?.length > 0 || field?.props?.type !== '') {
        fields.push(field)
      } else {
        // set blank text node to avoid empty text nodes in the markdown AST
        children[i] = _emptyASTNode()
      }
    }
  }

  // If no fields were generated, return early
  if (fields.length <= 0) {
    return
  }

  // Replace current children with the new field group
  children[currChildIdx] = {
    type: 'element',
    tag: 'field-group',
    children: [...fields],
  }
}

function _isJSDocBlock(children: MinimalNode): boolean {
  return (
    children?.tag === 'h3' && children?.children?.[0]?.tag === 'code' && children?.children?.[0]?.type === 'element'
  )
}

function _parseJSDocName(node: MinimalNode): string {
  // Code block || id prop || empty string
  return node.children?.[0]?.children?.[0]?.value || node?.props?.id || ''
}
function _parseJSDocType(node: MinimalNode): string {
  const hasType = !!node?.children?.[0]?.children?.[0]?.children?.[0]?.value
  if (!hasType) {
    return ''
  }

  return node?.children?.[0]?.children?.[2]?.children?.[0]?.value || ''
}

// --- internal utils ---

function _getTextContent(node: MinimalNode): string {
  if (typeof node === 'string') {
    return node
  }
  return node.slice(2).map(_getTextContent).join('')
}

function _emptyASTNode() {
  return { type: 'text', value: '' }
}
