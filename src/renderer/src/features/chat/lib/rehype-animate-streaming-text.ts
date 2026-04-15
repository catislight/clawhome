type HastNode = {
  type?: string
  tagName?: string
  value?: string
  children?: HastNode[]
  properties?: Record<string, unknown>
}

const NON_ANIMATED_TAGS = new Set(['code', 'pre', 'script', 'style'])

function createAnimatedTextNode(segment: string): HastNode {
  return {
    type: 'element',
    tagName: 'span',
    properties: {
      className: ['streaming-assistant-char']
    },
    children: [
      {
        type: 'text',
        value: segment
      }
    ]
  }
}

function splitGraphemes(value: string): string[] {
  if (!value) {
    return []
  }

  if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) {
    return Array.from(value)
  }

  const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })
  return Array.from(segmenter.segment(value), (segment) => segment.segment)
}

function splitLastAnimatedSegment(value: string): {
  prefix: string
  segment: string
  suffix: string
} | null {
  if (!value.trim()) {
    return null
  }

  const trailingWhitespaceMatch = value.match(/\s+$/u)
  const suffix = trailingWhitespaceMatch?.[0] ?? ''
  const coreValue = suffix ? value.slice(0, -suffix.length) : value
  const coreSegments = splitGraphemes(coreValue)
  const segment = coreSegments.pop()

  if (!segment) {
    return null
  }

  return {
    prefix: coreSegments.join(''),
    segment,
    suffix
  }
}

function transformNode(node: HastNode, insideNonAnimatedTag: boolean): boolean {
  if (!Array.isArray(node.children) || node.children.length === 0) {
    return false
  }

  const nextInsideNonAnimatedTag =
    insideNonAnimatedTag ||
    (node.type === 'element' && NON_ANIMATED_TAGS.has((node.tagName ?? '').toLowerCase()))

  for (let index = node.children.length - 1; index >= 0; index -= 1) {
    const child = node.children[index]
    if (
      !nextInsideNonAnimatedTag &&
      child.type === 'text' &&
      typeof child.value === 'string' &&
      child.value.length > 0 &&
      child.value.trim().length > 0
    ) {
      const splitResult = splitLastAnimatedSegment(child.value)
      if (!splitResult) {
        return false
      }

      const replacementNodes: HastNode[] = []

      if (splitResult.prefix) {
        replacementNodes.push({
          type: 'text',
          value: splitResult.prefix
        })
      }

      replacementNodes.push(createAnimatedTextNode(splitResult.segment))

      if (splitResult.suffix) {
        replacementNodes.push({
          type: 'text',
          value: splitResult.suffix
        })
      }

      node.children.splice(index, 1, ...replacementNodes)
      return true
    }

    if (transformNode(child, nextInsideNonAnimatedTag)) {
      return true
    }
  }

  return false
}

export function rehypeAnimateStreamingText() {
  return (tree: HastNode): void => {
    transformNode(tree, false)
  }
}
