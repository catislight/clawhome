import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import MarkdownContent from '../renderer/src/features/chat/components/markdown-content'

describe('MarkdownContent', () => {
  it('renders unfinished fenced code blocks in optimistic mode', () => {
    const { container } = render(
      <MarkdownContent content={'```ts\nconst answer = 42'} highlightCode={false} optimistic />
    )

    expect(screen.getByText('const answer = 42')).toBeInTheDocument()
    expect(container.querySelector('.markdown-code-block pre code')?.textContent).toContain(
      'const answer = 42'
    )
  })

  it('renders indented code blocks as preformatted code', () => {
    const { container } = render(
      <MarkdownContent
        content={'最简版，Python：\n\n    def quicksort(arr):\n        return arr'}
        highlightCode={false}
      />
    )

    const codeElement = container.querySelector('pre code')
    expect(codeElement).not.toBeNull()
    expect(codeElement?.textContent).toContain('def quicksort(arr):')
  })

  it('upgrades malformed ai code snippets into fenced code blocks', () => {
    const { container } = render(
      <MarkdownContent
        content={
          '最简版，Python：\n\ndef quicksort(arr):\n    if len(arr) <= 1:\n        return arr'
        }
        highlightCode={false}
      />
    )

    const codeElement = container.querySelector('pre code')
    expect(codeElement).not.toBeNull()
    expect(codeElement?.textContent).toContain('def quicksort(arr):')
  })

  it('does not mistakenly turn html mixed content sections into code blocks', () => {
    const { container } = render(
      <MarkdownContent
        content={'### HTML 混排测试\n\n<b>HTML 粗体</b>\n<i>HTML 斜体</i>'}
        highlightCode={false}
      />
    )

    expect(container.querySelector('pre code')).toBeNull()
    expect(screen.getByText('<b>HTML 粗体</b>', { exact: false })).toBeInTheDocument()
  })

  it('renders markdown lists as list items', () => {
    const { container } = render(
      <MarkdownContent
        content={'- 第一项\n- 第二项\n\n1. 第三项\n2. 第四项'}
        highlightCode={false}
      />
    )

    expect(container.querySelectorAll('ul > li')).toHaveLength(2)
    expect(container.querySelectorAll('ol > li')).toHaveLength(2)
    expect(screen.getByText('第一项')).toBeInTheDocument()
    expect(screen.getByText('第四项')).toBeInTheDocument()
  })

  it('preserves plain paragraph newlines in rendered output', () => {
    const { container } = render(
      <MarkdownContent content={'第一行\n第二行'} highlightCode={false} />
    )

    const paragraph = container.querySelector('p')

    expect(paragraph?.className).toContain('whitespace-pre-line')
    expect(paragraph?.textContent).toBe('第一行\n第二行')
  })

  it('syntax highlights closed fenced code blocks while streaming', async () => {
    const { container } = render(
      <MarkdownContent content={'```ts\nconst answer = 42\n```'} optimistic />
    )

    await waitFor(() => {
      expect(container.querySelector('.markdown-code-block .markdown-syntax-highlighter')).not.toBeNull()
    })
  })

  it('syntax highlights shell fenced code blocks', async () => {
    const { container } = render(
      <MarkdownContent content={'```shell\necho \"hello\"\n```'} />
    )

    await waitFor(() => {
      expect(container.querySelector('.markdown-code-block .markdown-syntax-highlighter')).not.toBeNull()
    })
  })

  it('syntax highlights c++ fenced code blocks', async () => {
    const { container } = render(
      <MarkdownContent content={'```c++\nint main() { return 0; }\n```'} />
    )

    await waitFor(() => {
      expect(container.querySelector('.markdown-code-block .markdown-syntax-highlighter')).not.toBeNull()
    })
  })
})
