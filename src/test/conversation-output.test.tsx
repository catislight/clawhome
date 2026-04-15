import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ConversationOutput from '../renderer/src/features/chat/components/conversation-output'
import {
  createInitialKnowledgeBaseStoreState,
  useKnowledgeBaseStore
} from '../renderer/src/features/knowledge-base/store/use-knowledge-base-store'
import type { ConversationMessage } from '../renderer/src/shared/contracts/chat-conversation'

const messages: ConversationMessage[] = [
  {
    id: 'assistant-1',
    role: 'assistant',
    content: '**你好**，这里是 `markdown` 回复。',
    timeLabel: '10:24'
  },
  {
    id: 'user-1',
    role: 'user',
    content: '收到。',
    timeLabel: '10:25',
    status: 'sent'
  }
]

describe('ConversationOutput', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useKnowledgeBaseStore.setState(createInitialKnowledgeBaseStoreState())
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    })
  })

  it('renders message content and metadata', () => {
    render(<ConversationOutput messages={messages} />)

    expect(screen.getByRole('log')).toBeInTheDocument()
    expect(screen.getByText('你好')).toBeInTheDocument()
    expect(screen.getByText('markdown')).toBeInTheDocument()
    expect(screen.getByText('收到。')).toBeInTheDocument()
    expect(screen.getByText('10:24')).toBeInTheDocument()
    expect(screen.getByText('10:25')).toBeInTheDocument()
    expect(screen.getByLabelText('已发送')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '复制回复' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '收藏回复' })).toBeInTheDocument()
  })

  it('renders user tags in message bubble', () => {
    render(
      <ConversationOutput
        messages={[
          {
            id: 'user-with-tags',
            role: 'user',
            content: '请看这张图',
            timeLabel: '10:26',
            status: 'sent',
            tags: [
              {
                type: 'image',
                label: 'screen.png'
              },
              {
                type: 'attachment',
                label: 'report.pdf'
              }
            ]
          }
        ]}
      />
    )

    expect(screen.getByText('图片')).toBeInTheDocument()
    expect(screen.getByText('screen.png')).toBeInTheDocument()
    expect(screen.getByText('附件')).toBeInTheDocument()
    expect(screen.getByText('report.pdf')).toBeInTheDocument()
  })

  it('opens image preview dialog when clicking image tag', () => {
    render(
      <ConversationOutput
        messages={[
          {
            id: 'user-image-tag-preview',
            role: 'user',
            content: '请帮我看这张图',
            timeLabel: '10:27',
            status: 'sent',
            tags: [
              {
                type: 'image',
                label: 'preview.png',
                previewSrc: 'data:image/png;base64,QUJDRA=='
              }
            ]
          }
        ]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /preview\.png/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByAltText('preview.png')).toBeInTheDocument()
  })

  it('loads preview for history image tag by absolute path', async () => {
    const readWorkspaceImageMock = vi.mocked(window.api.readWorkspaceImage)
    readWorkspaceImageMock.mockResolvedValueOnce({
      success: true,
      message: 'ok',
      mimeType: 'image/png',
      base64Data: 'QUJDRA==',
      absolutePath: '/workspace/images/history.png'
    })

    render(
      <ConversationOutput
        messages={[
          {
            id: 'user-image-tag-history-preview',
            role: 'user',
            content: '回放消息',
            timeLabel: '10:28',
            status: 'sent',
            tags: [
              {
                type: 'image',
                label: 'history.png',
                absolutePath: '/workspace/images/history.png',
                relativePath: 'images/history.png'
              }
            ]
          }
        ]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /history\.png/i }))

    await waitFor(() => {
      expect(readWorkspaceImageMock).toHaveBeenCalledWith({
        absolutePath: '/workspace/images/history.png',
        relativePath: 'images/history.png',
        connection: undefined
      })
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByAltText('history.png')).toBeInTheDocument()
    })
  })

  it('closes image preview when clicking the top-right close icon', () => {
    render(
      <ConversationOutput
        messages={[
          {
            id: 'user-image-tag-preview-close',
            role: 'user',
            content: '请帮我看这张图',
            timeLabel: '10:27',
            status: 'sent',
            tags: [
              {
                type: 'image',
                label: 'close-preview.png',
                previewSrc: 'data:image/png;base64,QUJDRA=='
              }
            ]
          }
        ]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /close-preview\.png/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '关闭图片预览' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('copies assistant reply from the action bar', async () => {
    const writeTextMock = vi.mocked(navigator.clipboard.writeText)

    render(<ConversationOutput messages={messages} />)

    fireEvent.click(screen.getByRole('button', { name: '复制回复' }))

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('**你好**，这里是 `markdown` 回复。')
      expect(screen.getByRole('button', { name: '已复制回复' })).toBeInTheDocument()
    })
  })

  it('collects assistant reply into knowledge base favorites', () => {
    render(<ConversationOutput messages={messages} />)

    const favoriteButton = screen.getByRole('button', { name: '收藏回复' })
    fireEvent.click(favoriteButton)

    const store = useKnowledgeBaseStore.getState()
    expect(store.favorites).toHaveLength(1)
    expect(store.favorites[0].content).toBe('**你好**，这里是 `markdown` 回复。')
    expect(screen.getByRole('button', { name: '已收藏回复' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '已收藏回复' }))
    expect(useKnowledgeBaseStore.getState().favorites).toHaveLength(1)
  })

  it('renders empty state without message items', () => {
    render(<ConversationOutput messages={[]} emptyState={<p>暂无消息</p>} />)

    expect(screen.getByRole('log')).toBeInTheDocument()
    expect(screen.getByText('暂无消息')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('embeds run trace metadata in the first assistant bubble for the same run', () => {
    render(
      <ConversationOutput
        messages={[
          {
            id: 'assistant-run-1',
            runId: 'run-1',
            role: 'assistant',
            content: '第一段',
            timeLabel: '10:30'
          },
          {
            id: 'assistant-run-1-segment-1',
            runId: 'run-1',
            role: 'assistant',
            content: '第二段',
            timeLabel: '10:31',
            status: 'streaming'
          }
        ]}
        messageTraces={{
          'run-1': {
            skills: ['openai-docs'],
            tools: ['read', 'web_search'],
            activeToolCallIds: ['tool-1'],
            activeToolCalls: [
              {
                toolCallId: 'tool-1',
                toolName: 'read',
                skillName: 'openai-docs'
              }
            ],
            isGenerating: true
          }
        }}
      />
    )

    expect(screen.getAllByText('Skill')).toHaveLength(1)
    const traceStatus = screen.getByText('正在阅读 openai-docs skill')
    expect(traceStatus).toBeInTheDocument()
    expect(traceStatus.closest('article')).toBeInTheDocument()
    expect(screen.getByText('第一段')).toBeInTheDocument()
    expect(
      screen.getAllByText((_, node) => node?.textContent?.replace(/\s+/g, '') === '第二段').length
    ).toBeGreaterThan(0)
  })

  it('keeps trace metadata visible after tool result while assistant text is still pending', () => {
    render(
      <ConversationOutput
        messages={[
          {
            id: 'assistant-run-pending-result',
            runId: 'run-pending-result',
            role: 'assistant',
            content: '',
            timeLabel: '10:33',
            status: 'streaming'
          }
        ]}
        messageTraces={{
          'run-pending-result': {
            skills: [],
            tools: ['browser'],
            activeToolCallIds: [],
            activeToolCalls: [],
            isGenerating: true
          }
        }}
      />
    )

    expect(screen.getByText('Tool')).toBeInTheDocument()
    expect(screen.getByText('browser')).toBeInTheDocument()
    expect(screen.getByText('正在生成回复…')).toBeInTheDocument()
    expect(screen.queryByText('正在生成…')).not.toBeInTheDocument()
  })
})
