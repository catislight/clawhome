import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { SlashInputContent } from '../renderer/src/features/chat/components/editor/extensions/send-content/SendContent.utils'
import type { CommandItem } from '../renderer/src/features/chat/components/editor/extensions/slash-command/SlashCommand.types'
import ConversationInput from '../renderer/src/features/chat/components/conversation-input'

const mockSlashInput = vi.fn()

vi.mock('../renderer/src/features/chat/components/editor/SlashInput', () => ({
  default: (props: {
    onSend?: (content: SlashInputContent) => void
    footerLeading?: ReactNode
    slashItems?: CommandItem[]
  }) => {
    mockSlashInput(props)
    return (
      <div>
        <div>{props.footerLeading}</div>
        <button
          type="button"
          onClick={() =>
            props.onSend?.({
              raw: { type: 'doc', content: [] },
              text: '请总结这些上下文',
              images: [
                {
                  src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
                  fileName: 'screenshot.png'
                }
              ],
              attachments: [{ fileName: 'report.pdf' }],
              tags: [{ label: 'notes.txt', content: '关键内容', metadata: null }]
            })
          }
        >
          trigger-send
        </button>
        <button
          type="button"
          onClick={() =>
            props.onSend?.({
              raw: { type: 'doc', content: [] },
              text: '',
              images: [],
              attachments: [],
              tags: []
            })
          }
        >
          trigger-empty
        </button>
      </div>
    )
  }
}))

describe('ConversationInput', () => {
  it('composes slash input content and submits message text', async () => {
    const handleSubmit = vi.fn()

    render(<ConversationInput onSubmit={handleSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: 'trigger-send' }))

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledTimes(1)
    })
    const payload = handleSubmit.mock.calls[0]?.[0]
    expect(payload.message).toContain('请总结这些上下文')
    expect(payload.message).toContain('文件 notes.txt')
    expect(payload.message).toContain('关键内容')
    expect(payload.message).toContain('[附件] report.pdf')
    expect(payload.images).toEqual([
      {
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
        fileName: 'screenshot.png',
        relativePath: undefined,
        absolutePath: undefined
      }
    ])
    expect(payload.tags).toEqual([
      {
        type: 'image',
        label: 'screenshot.png',
        previewSrc: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
        relativePath: undefined,
        absolutePath: undefined
      },
      {
        type: 'text',
        label: 'notes.txt'
      },
      {
        type: 'attachment',
        label: 'report.pdf'
      }
    ])
  })

  it('ignores empty send payload', () => {
    const handleSubmit = vi.fn()

    render(<ConversationInput onSubmit={handleSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: 'trigger-empty' }))

    expect(handleSubmit).not.toHaveBeenCalled()
  })

  it('forwards footerLeading to slash input container', () => {
    render(<ConversationInput onSubmit={vi.fn()} footerLeading={<span>模型切换器</span>} />)

    expect(screen.getByText('模型切换器')).toBeInTheDocument()
  })

  it('injects openclaw slash command items for input menu', () => {
    render(<ConversationInput onSubmit={vi.fn()} />)

    const firstRenderProps = mockSlashInput.mock.calls[0]?.[0] as { slashItems?: CommandItem[] }
    expect(firstRenderProps.slashItems?.some((item) => item.title === '/status')).toBe(true)
    expect(firstRenderProps.slashItems?.some((item) => item.title === '/model')).toBe(true)
    expect(firstRenderProps.slashItems?.some((item) => item.title === '/think')).toBe(true)
  })
})
