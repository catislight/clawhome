import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SshConnectionFormValues } from '../renderer/src/features/instances/model/ssh-connection'
import HomePage from '../renderer/src/features/chat/pages/home-page'
import {
  createInitialAppStoreState,
  useAppStore
} from '../renderer/src/features/instances/store/use-app-store'
import { useGatewayConversationStore } from '../renderer/src/stores/use-gateway-conversation-store'

vi.mock('../renderer/src/features/chat/components/editor/SlashInput', () => ({
  default: function MockSlashInput(props: {
    onSend?: (content: {
      raw: { type: string; content: never[] }
      text: string
      images: unknown[]
      attachments: unknown[]
      tags: unknown[]
    }) => void
    ariaLabel?: string
    submitLabel?: string
    disabled?: boolean
    submitting?: boolean
    footerLeading?: ReactNode
  }): React.JSX.Element {
    const [value, setValue] = useState('')
    const locked = Boolean(props.disabled || props.submitting)

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!value.trim() || locked) {
            return
          }
          props.onSend?.({
            raw: { type: 'doc', content: [] },
            text: value,
            images: [],
            attachments: [],
            tags: []
          })
          setValue('')
        }}
      >
        <div>{props.footerLeading}</div>
        <textarea
          aria-label={props.ariaLabel ?? '消息输入框'}
          disabled={locked}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="submit" aria-label={props.submitLabel ?? '发送'} disabled={locked}>
          {props.submitLabel ?? '发送'}
        </button>
      </form>
    )
  }
}))

const mockConnectionConfig: SshConnectionFormValues = {
  title: 'root@prod',
  port: 22,
  host: '10.0.0.10',
  username: 'root',
  password: 'secret',
  privateKey: 'PRIVATE_KEY',
  privateKeyPassphrase: ''
}

describe('HomePage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAppStore.setState(createInitialAppStoreState())
    useGatewayConversationStore.setState({
      conversations: {},
      workspacePathByInstanceId: {},
      sessionModelOverrideByConversationKey: {}
    })
    vi.clearAllMocks()
  })

  it('sends chat messages and renders streamed assistant markdown', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: null
    })

    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async (payload) => {
      if (payload.method === 'chat.history') {
        return {
          success: true,
          message: 'mock history success',
          payload: {
            messages: []
          }
        }
      }

      if (payload.method === 'chat.subscribe') {
        return {
          success: true,
          message: 'mock subscribe success',
          payload: {}
        }
      }

      if (payload.method === 'chat.send') {
        return {
          success: true,
          message: 'mock chat send success',
          payload: {
            runId: 'ui-test-run',
            status: 'started'
          }
        }
      }

      return {
        success: true,
        message: 'mock request success',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockResolvedValueOnce({
      success: true,
      message: 'mock events success',
      events: []
    })

    pullGatewayEventsMock.mockResolvedValueOnce({
      success: true,
      message: 'mock events success',
      events: [
        {
          event: 'agent',
          receivedAt: '2026-03-21T08:00:58.500Z',
          payload: {
            runId: 'ui-test-run',
            sessionKey: 'agent:main:main',
            stream: 'assistant',
            data: {
              text: '我先抓项目 README 和仓库关键信息，给你一个简明解读。',
              delta: '我先抓项目 README 和仓库关键信息，给你一个简明解读。'
            }
          }
        },
        {
          event: 'agent',
          receivedAt: '2026-03-21T08:00:59.000Z',
          payload: {
            runId: 'ui-test-run',
            sessionKey: 'agent:main:main',
            stream: 'tool',
            data: {
              phase: 'start',
              name: 'read',
              toolCallId: 'tool-read-1',
              args: {
                path: '/workspace/skills/openai-docs/SKILL.md'
              }
            }
          }
        },
        {
          event: 'agent',
          receivedAt: '2026-03-21T08:00:59.200Z',
          payload: {
            runId: 'ui-test-run',
            sessionKey: 'agent:main:main',
            stream: 'tool',
            data: {
              phase: 'start',
              name: 'web_search',
              toolCallId: 'tool-search-1',
              args: {
                q: 'OpenAI docs'
              }
            }
          }
        }
      ]
    })

    pullGatewayEventsMock.mockResolvedValueOnce({
      success: true,
      message: 'mock events success',
      events: [
        {
          event: 'agent',
          receivedAt: '2026-03-21T08:01:00.000Z',
          payload: {
            runId: 'ui-test-run',
            sessionKey: 'agent:main:main',
            stream: 'assistant',
            data: {
              text: '**已收到**\n\n- 正在整理上下文',
              delta: '**已收到**\n\n- 正在整理上下文'
            }
          }
        }
      ]
    })

    pullGatewayEventsMock.mockResolvedValueOnce({
      success: true,
      message: 'mock events success',
      events: [
        {
          event: 'agent',
          receivedAt: '2026-03-21T08:01:01.000Z',
          payload: {
            runId: 'ui-test-run',
            sessionKey: 'agent:main:main',
            stream: 'tool',
            data: {
              phase: 'result',
              name: 'read',
              toolCallId: 'tool-read-1'
            }
          }
        },
        {
          event: 'agent',
          receivedAt: '2026-03-21T08:01:01.200Z',
          payload: {
            runId: 'ui-test-run',
            sessionKey: 'agent:main:main',
            stream: 'tool',
            data: {
              phase: 'result',
              name: 'web_search',
              toolCallId: 'tool-search-1'
            }
          }
        },
        {
          event: 'agent',
          receivedAt: '2026-03-21T08:01:01.300Z',
          payload: {
            runId: 'ui-test-run',
            sessionKey: 'agent:main:main',
            stream: 'assistant',
            data: {
              text: '**已收到**\n\n```python\ndef quicksort(arr):\n    return arr\n```',
              delta: '\n\n```python\ndef quicksort(arr):\n    return arr\n```'
            }
          }
        }
      ]
    })

    pullGatewayEventsMock.mockResolvedValue({
      success: true,
      message: 'mock events success',
      events: []
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText('对话输入框')).toBeEnabled()
    })

    fireEvent.change(screen.getByLabelText('对话输入框'), {
      target: {
        value: '请用 markdown 回复'
      }
    })

    fireEvent.submit(screen.getByLabelText('对话输入框').closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'chat.send'
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText('请用 markdown 回复')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(
        screen.getByText('我先抓项目 README 和仓库关键信息，给你一个简明解读。')
      ).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(
        screen.getAllByText(
          (_, node) => node?.textContent?.replace(/\s+/g, '').includes('已收到') ?? false
        ).length
      ).toBeGreaterThan(0)
    })

    expect(screen.getByText('openai-docs')).toBeInTheDocument()
    expect(screen.getByText('read')).toBeInTheDocument()
    expect(screen.getByText('web_search')).toBeInTheDocument()
    expect(screen.getAllByText('Skill')).toHaveLength(1)
    expect(screen.getAllByRole('article').length).toBeGreaterThanOrEqual(2)
  }, 12000)

  it('patches provider/model ref before sending when a cross-provider model is selected', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: null
    })

    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async (payload) => {
      if (payload.method === 'agents.list') {
        return {
          success: true,
          message: 'mock agents list',
          payload: {
            defaultId: 'main',
            mainKey: 'main',
            scope: 'global',
            agents: [{ id: 'main', name: '主智能体' }]
          }
        }
      }

      if (payload.method === 'models.list') {
        return {
          success: true,
          message: 'mock models list',
          payload: {
            models: [
              {
                id: 'MiniMax-M2.7-highspeed',
                name: 'MiniMax M2.7 Highspeed',
                provider: 'custom-right-codes'
              }
            ]
          }
        }
      }

      if (payload.method === 'chat.history') {
        return {
          success: true,
          message: 'mock history success',
          payload: {
            messages: []
          }
        }
      }

      if (payload.method === 'chat.subscribe') {
        return {
          success: true,
          message: 'mock subscribe success',
          payload: {}
        }
      }

      if (payload.method === 'sessions.patch') {
        return {
          success: true,
          message: 'mock session patch success',
          payload: {
            ok: true
          }
        }
      }

      if (payload.method === 'chat.send') {
        return {
          success: true,
          message: 'mock chat send success',
          payload: {
            runId: 'ui-test-run',
            status: 'started'
          }
        }
      }

      return {
        success: true,
        message: 'mock request success',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockResolvedValue({
      success: true,
      message: 'mock events success',
      events: []
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText('对话输入框')).toBeEnabled()
      expect(screen.getByLabelText('切换模型')).toBeEnabled()
    })

    fireEvent.click(screen.getByLabelText('切换模型'))

    const modelListbox = await screen.findByRole('listbox')
    fireEvent.click(within(modelListbox).getByRole('option', { name: 'MiniMax M2.7 Highspeed' }))

    fireEvent.change(screen.getByLabelText('对话输入框'), {
      target: {
        value: '切到 MiniMax 回答'
      }
    })
    fireEvent.submit(screen.getByLabelText('对话输入框').closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'chat.send'
        })
      )
    })

    const modelPatchCallIndex = requestGatewayMock.mock.calls.findIndex(
      ([request]) => request.method === 'sessions.patch'
    )
    const chatSendCallIndex = requestGatewayMock.mock.calls.findIndex(
      ([request]) => request.method === 'chat.send'
    )

    expect(modelPatchCallIndex).toBeGreaterThan(-1)
    expect(chatSendCallIndex).toBeGreaterThan(modelPatchCallIndex)
    expect(requestGatewayMock.mock.calls[modelPatchCallIndex]?.[0]).toMatchObject({
      method: 'sessions.patch',
      params: {
        key: 'agent:main:main',
        model: 'custom-right-codes/MiniMax-M2.7-highspeed'
      }
    })
  })

  it('keeps optimistic cards visible after leaving and returning while a reply is still streaming', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '腾讯云',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: null
    })

    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async (payload) => {
      if (payload.method === 'chat.subscribe') {
        return {
          success: true,
          message: 'mock subscribe success',
          payload: {}
        }
      }

      if (payload.method === 'chat.history') {
        return {
          success: true,
          message: 'mock history success',
          payload: {
            messages: []
          }
        }
      }

      if (payload.method === 'chat.send') {
        return {
          success: true,
          message: 'mock chat send success',
          payload: {
            runId: 'ui-test-run',
            status: 'started'
          }
        }
      }

      return {
        success: true,
        message: 'mock request success',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockResolvedValue({
      success: true,
      message: 'mock events success',
      events: []
    })

    const firstRender = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'chat.history'
        })
      )
    })

    fireEvent.change(screen.getByLabelText('对话输入框'), {
      target: { value: '请继续刚才的分析' }
    })
    fireEvent.submit(screen.getByLabelText('对话输入框').closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(screen.getByText('请继续刚才的分析')).toBeInTheDocument()
      expect(screen.getByText('正在生成…')).toBeInTheDocument()
    })

    firstRender.unmount()

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('请继续刚才的分析')).toBeInTheDocument()
      expect(screen.getByText('正在生成…')).toBeInTheDocument()
    })
  })

  it('keeps the history loading state visible until initial transcript messages are ready', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '腾讯云',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: null
    })

    let resolveHistoryRequest:
      | ((value: {
          success: boolean
          message: string
          payload: {
            messages: Array<{
              id: string
              role: string
              createdAt: string
              content: Array<{ type: string; text: string }>
            }>
          }
        }) => void)
      | null = null

    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(
      async (payload): Promise<{ success: boolean; message: string; payload: unknown }> => {
        if (payload.method === 'chat.subscribe') {
          return {
            success: true,
            message: 'mock subscribe success',
            payload: {}
          }
        }

        if (payload.method === 'chat.history') {
          return await new Promise((resolve) => {
            resolveHistoryRequest = resolve
          })
        }

        return {
          success: true,
          message: 'mock request success',
          payload: {}
        }
      }
    )

    pullGatewayEventsMock.mockResolvedValue({
      success: true,
      message: 'mock events success',
      events: []
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('正在同步聊天记录…')).toBeInTheDocument()
    })

    expect(screen.queryByText('现在可以直接发送消息')).not.toBeInTheDocument()

    resolveHistoryRequest?.({
      success: true,
      message: 'mock history success',
      payload: {
        messages: [
          {
            id: 'history-assistant-1',
            role: 'assistant',
            createdAt: '2026-03-21T08:05:00.000Z',
            content: [
              {
                type: 'text',
                text: '这里是已加载的历史消息'
              }
            ]
          }
        ]
      }
    })

    await waitFor(() => {
      expect(screen.getByText('这里是已加载的历史消息')).toBeInTheDocument()
    })

    expect(screen.queryByText('正在同步聊天记录…')).not.toBeInTheDocument()
    expect(screen.queryByText('现在可以直接发送消息')).not.toBeInTheDocument()
  })

  it('shows reconnect panel actions when the instance is not connected', () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'disconnected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: '与 OpenClaw 的连接已断开，请重新连接。'
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    expect(screen.queryByLabelText('对话中心更多操作')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新连接' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '实例管理' })).toBeEnabled()
  })

  it('reconciles completed streamed replies from chat history without a manual refresh', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: null
    })

    let historyCallCount = 0
    let chatRunId = 'ui-test-run'
    let pullEventsCallCount = 0
    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async (payload) => {
      if (payload.method === 'chat.history') {
        historyCallCount += 1

        return {
          success: true,
          message: 'mock history success',
          payload: {
            messages:
              historyCallCount === 1
                ? []
                : [
                    {
                      id: 'history-user-1',
                      role: 'user',
                      runId: chatRunId,
                      createdAt: '2026-03-21T08:01:00.000Z',
                      content: [
                        {
                          type: 'text',
                          text: '请用 markdown 回复'
                        }
                      ]
                    },
                    {
                      id: 'history-assistant-1',
                      role: 'assistant',
                      runId: chatRunId,
                      createdAt: '2026-03-21T08:01:02.000Z',
                      content: [
                        {
                          type: 'text',
                          text: '1. 父项\n   1. 子项'
                        }
                      ]
                    }
                  ]
          }
        }
      }

      if (payload.method === 'chat.subscribe') {
        return {
          success: true,
          message: 'mock subscribe success',
          payload: {}
        }
      }

      if (payload.method === 'chat.send') {
        chatRunId =
          payload.params && typeof payload.params === 'object' && payload.params !== null
            ? String((payload.params as { idempotencyKey?: string }).idempotencyKey ?? chatRunId)
            : chatRunId

        return {
          success: true,
          message: 'mock chat send success',
          payload: {
            runId: chatRunId,
            status: 'started'
          }
        }
      }

      return {
        success: true,
        message: 'mock request success',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockImplementation(async () => {
      pullEventsCallCount += 1

      if (pullEventsCallCount === 1) {
        return {
          success: true,
          message: 'mock events success',
          events: []
        }
      }

      if (pullEventsCallCount === 2) {
        return {
          success: true,
          message: 'mock events success',
          events: [
            {
              event: 'agent',
              receivedAt: '2026-03-21T08:01:01.000Z',
              payload: {
                runId: chatRunId,
                sessionKey: 'agent:main:main',
                stream: 'assistant',
                data: {
                  text: '1. 父项\n1. 子项',
                  delta: '1. 父项\n1. 子项'
                }
              }
            },
            {
              event: 'agent',
              receivedAt: '2026-03-21T08:01:01.200Z',
              payload: {
                runId: chatRunId,
                sessionKey: 'agent:main:main',
                stream: 'lifecycle',
                data: {
                  phase: 'end'
                }
              }
            }
          ]
        }
      }

      return {
        success: true,
        message: 'mock events success',
        events: []
      }
    })

    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText('对话输入框')).toBeEnabled()
    })

    fireEvent.change(screen.getByLabelText('对话输入框'), {
      target: {
        value: '请用 markdown 回复'
      }
    })

    fireEvent.submit(screen.getByLabelText('对话输入框').closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'chat.send'
        })
      )
    })

    await waitFor(
      () => {
        expect(
          requestGatewayMock.mock.calls.filter(([payload]) => payload.method === 'chat.history')
            .length
        ).toBeGreaterThanOrEqual(2)
      },
      { timeout: 4000 }
    )

    await waitFor(() => {
      const nestedListItem = container.querySelector('article ol ol > li')

      expect(nestedListItem).not.toBeNull()
      expect(nestedListItem?.textContent).toContain('子项')
    })
  }, 12000)

  it('reconciles non-streaming replies after lifecycle end even without chat final event', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: null
    })

    let historyCallCount = 0
    let chatRunId = 'ui-non-stream-run'
    let pullEventsCallCount = 0
    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async (payload) => {
      if (payload.method === 'chat.history') {
        historyCallCount += 1

        return {
          success: true,
          message: 'mock history success',
          payload: {
            messages:
              historyCallCount === 1
                ? []
                : [
                    {
                      id: 'history-user-non-stream-1',
                      role: 'user',
                      runId: chatRunId,
                      createdAt: '2026-03-21T08:02:00.000Z',
                      content: [
                        {
                          type: 'text',
                          text: '给我一个简短总结'
                        }
                      ]
                    },
                    {
                      id: 'history-assistant-non-stream-1',
                      role: 'assistant',
                      runId: chatRunId,
                      createdAt: '2026-03-21T08:02:03.000Z',
                      content: [
                        {
                          type: 'text',
                          text: '这是非流式模型的最终回复。'
                        }
                      ]
                    }
                  ]
          }
        }
      }

      if (payload.method === 'chat.subscribe') {
        return {
          success: true,
          message: 'mock subscribe success',
          payload: {}
        }
      }

      if (payload.method === 'chat.send') {
        chatRunId =
          payload.params && typeof payload.params === 'object' && payload.params !== null
            ? String((payload.params as { idempotencyKey?: string }).idempotencyKey ?? chatRunId)
            : chatRunId

        return {
          success: true,
          message: 'mock chat send success',
          payload: {
            runId: chatRunId,
            status: 'started'
          }
        }
      }

      return {
        success: true,
        message: 'mock request success',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockImplementation(async () => {
      pullEventsCallCount += 1

      if (pullEventsCallCount === 1) {
        return {
          success: true,
          message: 'mock events success',
          events: []
        }
      }

      if (pullEventsCallCount === 2) {
        return {
          success: true,
          message: 'mock events success',
          events: [
            {
              event: 'agent',
              receivedAt: '2026-03-21T08:02:02.000Z',
              payload: {
                runId: chatRunId,
                sessionKey: 'agent:main:main',
                stream: 'lifecycle',
                data: {
                  phase: 'end'
                }
              }
            }
          ]
        }
      }

      return {
        success: true,
        message: 'mock events success',
        events: []
      }
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText('对话输入框')).toBeEnabled()
    })

    fireEvent.change(screen.getByLabelText('对话输入框'), {
      target: {
        value: '给我一个简短总结'
      }
    })

    fireEvent.submit(screen.getByLabelText('对话输入框').closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'chat.send'
        })
      )
    })

    await waitFor(() => {
      expect(
        requestGatewayMock.mock.calls.filter(([payload]) => payload.method === 'chat.history')
          .length
      ).toBeGreaterThanOrEqual(2)
    })

    await waitFor(() => {
      expect(screen.getByText('这是非流式模型的最终回复。')).toBeInTheDocument()
    })
    expect(screen.queryByText('正在同步模型最终回复…')).not.toBeInTheDocument()
  }, 12000)

  it('keeps the generating card visible for non-streaming empty final events until history is reconciled', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: null
    })

    let historyCallCount = 0
    let chatRunId = 'ui-non-stream-empty-final-run'
    let pullEventsCallCount = 0
    let resolveReconcileHistory:
      | ((value: {
          success: boolean
          message: string
          payload: {
            messages: Array<{
              id: string
              role: string
              runId: string
              createdAt: string
              content: Array<{ type: string; text: string }>
            }>
          }
        }) => void)
      | null = null
    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async (payload) => {
      if (payload.method === 'chat.history') {
        historyCallCount += 1

        if (historyCallCount === 1) {
          return {
            success: true,
            message: 'mock history success',
            payload: {
              messages: []
            }
          }
        }

        return await new Promise((resolve) => {
          resolveReconcileHistory = resolve
        })
      }

      if (payload.method === 'chat.subscribe') {
        return {
          success: true,
          message: 'mock subscribe success',
          payload: {}
        }
      }

      if (payload.method === 'chat.send') {
        chatRunId =
          payload.params && typeof payload.params === 'object' && payload.params !== null
            ? String((payload.params as { idempotencyKey?: string }).idempotencyKey ?? chatRunId)
            : chatRunId

        return {
          success: true,
          message: 'mock chat send success',
          payload: {
            runId: chatRunId,
            status: 'started'
          }
        }
      }

      return {
        success: true,
        message: 'mock request success',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockImplementation(async () => {
      pullEventsCallCount += 1

      if (pullEventsCallCount === 1) {
        return {
          success: true,
          message: 'mock events success',
          events: []
        }
      }

      if (pullEventsCallCount === 2) {
        return {
          success: true,
          message: 'mock events success',
          events: [
            {
              event: 'chat',
              receivedAt: '2026-03-21T08:12:02.000Z',
              payload: {
                runId: chatRunId,
                sessionKey: 'agent:main:main',
                state: 'final',
                message: ''
              }
            }
          ]
        }
      }

      return {
        success: true,
        message: 'mock events success',
        events: []
      }
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText('对话输入框')).toBeEnabled()
    })

    fireEvent.change(screen.getByLabelText('对话输入框'), {
      target: {
        value: '给我一个非流式总结'
      }
    })

    fireEvent.submit(screen.getByLabelText('对话输入框').closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'chat.send'
        })
      )
      expect(screen.getByText('给我一个非流式总结')).toBeInTheDocument()
      expect(screen.getByText('正在生成…')).toBeInTheDocument()
    })

    expect(screen.queryByText('正在同步模型最终回复…')).not.toBeInTheDocument()

    await waitFor(
      () => {
        expect(
          requestGatewayMock.mock.calls.filter(([payload]) => payload.method === 'chat.history')
            .length
        ).toBeGreaterThanOrEqual(2)
      },
      { timeout: 4000 }
    )

    expect(screen.getByText('正在生成…')).toBeInTheDocument()
    expect(screen.queryByText('正在同步模型最终回复…')).not.toBeInTheDocument()

    resolveReconcileHistory?.({
      success: true,
      message: 'mock history success',
      payload: {
        messages: [
          {
            id: 'history-user-non-stream-empty-final-1',
            role: 'user',
            runId: chatRunId,
            createdAt: '2026-03-21T08:12:00.000Z',
            content: [
              {
                type: 'text',
                text: '给我一个非流式总结'
              }
            ]
          },
          {
            id: 'history-assistant-non-stream-empty-final-1',
            role: 'assistant',
            runId: chatRunId,
            createdAt: '2026-03-21T08:12:03.000Z',
            content: [
              {
                type: 'text',
                text: '这是最终非流式回复。'
              }
            ]
          }
        ]
      }
    })

    await waitFor(() => {
      expect(screen.getByText('这是最终非流式回复。')).toBeInTheDocument()
    })

    expect(screen.queryByText('正在生成…')).not.toBeInTheDocument()
    expect(screen.queryByText('正在同步模型最终回复…')).not.toBeInTheDocument()
  }, 12000)

  it('creates a new session without deleting the previous conversation history', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: null
    })

    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async (payload) => {
      if (payload.method === 'chat.history') {
        const requestedSessionKey =
          payload.params && typeof payload.params === 'object' && payload.params !== null
            ? (payload.params as { sessionKey?: string }).sessionKey
            : undefined
        const isMainSession =
          requestedSessionKey === undefined ||
          requestedSessionKey === 'main' ||
          requestedSessionKey === 'agent:main:main'

        return {
          success: true,
          message: 'mock history success',
          payload: {
            messages: isMainSession
              ? [
                  {
                    id: 'history-message-1',
                    role: 'user',
                    createdAt: '2026-03-21T08:01:00.000Z',
                    content: [
                      {
                        type: 'text',
                        text: '之前的对话内容'
                      }
                    ]
                  }
                ]
              : []
          }
        }
      }

      if (payload.method === 'chat.subscribe') {
        return {
          success: true,
          message: 'mock subscribe success',
          payload: {}
        }
      }

      if (payload.method === 'sessions.list') {
        return {
          success: true,
          message: 'mock sessions list success',
          payload: {
            sessions: [
              {
                key: 'agent:main:main',
                displayName: '主会话',
                updatedAt: 1_763_246_400_000
              }
            ]
          }
        }
      }

      if (payload.method === 'sessions.patch') {
        return {
          success: true,
          message: 'mock session patch success',
          payload: {
            ok: true
          }
        }
      }

      return {
        success: true,
        message: 'mock request success',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockResolvedValue({
      success: true,
      message: 'mock events success',
      events: []
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('之前的对话内容')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('对话中心更多操作'))
    fireEvent.click(screen.getByRole('menuitem', { name: '创建新会话' }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '创建新会话' })).toBeEnabled()
    })

    fireEvent.click(screen.getByRole('button', { name: '创建新会话' }))

    await waitFor(() => {
      const createdSessionHistoryCall = requestGatewayMock.mock.calls.find(([request]) => {
        if (request.method !== 'chat.history') {
          return false
        }

        const sessionKey =
          request.params && typeof request.params === 'object' && request.params !== null
            ? (request.params as { sessionKey?: string }).sessionKey
            : undefined

        return (
          typeof sessionKey === 'string' &&
          sessionKey !== 'main' &&
          sessionKey !== 'agent:main:main'
        )
      })

      expect(createdSessionHistoryCall?.[0].params).toMatchObject({
        sessionKey: expect.stringMatching(/^ui:/)
      })
    })

    expect(requestGatewayMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'sessions.patch',
        params: expect.objectContaining({
          label: expect.stringMatching(/^新会话 /)
        })
      })
    )

    await waitFor(() => {
      expect(screen.queryByText('之前的对话内容')).not.toBeInTheDocument()
      expect(screen.getByText('现在可以直接发送消息')).toBeInTheDocument()
    })

    expect(
      requestGatewayMock.mock.calls.some(([request]) => request.method === 'sessions.reset')
    ).toBe(false)

    fireEvent.click(screen.getByLabelText('对话中心更多操作'))
    fireEvent.click(screen.getByRole('menuitem', { name: '切换会话' }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '主会话' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '主会话' }))
    fireEvent.click(screen.getByRole('button', { name: '切换会话' }))

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'chat.history',
          params: {
            sessionKey: 'agent:main:main'
          }
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText('之前的对话内容')).toBeInTheDocument()
    })
  })

  it('uses the provided name when creating a new session', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: null
    })

    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async (payload) => {
      if (payload.method === 'chat.subscribe') {
        return {
          success: true,
          message: 'mock subscribe success',
          payload: {}
        }
      }

      if (payload.method === 'chat.history') {
        const requestedSessionKey =
          payload.params && typeof payload.params === 'object' && payload.params !== null
            ? (payload.params as { sessionKey?: string }).sessionKey
            : undefined

        return {
          success: true,
          message: 'mock history success',
          payload: {
            messages:
              requestedSessionKey === undefined ||
              requestedSessionKey === 'main' ||
              requestedSessionKey === 'agent:main:main'
                ? [
                    {
                      id: 'history-message-1',
                      role: 'assistant',
                      createdAt: '2026-03-21T08:01:00.000Z',
                      content: [
                        {
                          type: 'text',
                          text: '这里是默认会话'
                        }
                      ]
                    }
                  ]
                : []
          }
        }
      }

      if (payload.method === 'sessions.list') {
        return {
          success: true,
          message: 'mock sessions list success',
          payload: {
            sessions: [
              {
                key: 'agent:main:main',
                displayName: '主会话',
                updatedAt: 1_763_246_400_000
              }
            ]
          }
        }
      }

      if (payload.method === 'sessions.patch') {
        return {
          success: true,
          message: 'mock session patch success',
          payload: {
            ok: true
          }
        }
      }

      return {
        success: true,
        message: 'mock request success',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockResolvedValue({
      success: true,
      message: 'mock events success',
      events: []
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('这里是默认会话')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('对话中心更多操作'))
    fireEvent.click(screen.getByRole('menuitem', { name: '创建新会话' }))

    await waitFor(() => {
      expect(screen.getByLabelText('会话名称')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('会话名称'), {
      target: {
        value: '排查 release 通知'
      }
    })

    fireEvent.click(screen.getByRole('button', { name: '创建新会话' }))

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'sessions.patch',
          params: expect.objectContaining({
            label: '排查 release 通知'
          })
        })
      )
    })

    fireEvent.click(screen.getByLabelText('对话中心更多操作'))
    fireEvent.click(screen.getByRole('menuitem', { name: '切换会话' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '排查 release 通知' })).toBeInTheDocument()
    })
  })

  it('renames a session from the switch dialog overflow menu', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: null
    })

    let sessionsRows: Array<{
      key: string
      displayName?: string
      label?: string
      updatedAt: number
    }> = [
      {
        key: 'agent:main:main',
        displayName: '主会话',
        updatedAt: 1_763_246_400_000
      },
      {
        key: 'agent:main:work',
        label: '待改名会话',
        updatedAt: 1_763_246_700_000
      }
    ]

    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async (payload) => {
      if (payload.method === 'chat.subscribe') {
        return {
          success: true,
          message: 'mock subscribe success',
          payload: {}
        }
      }

      if (payload.method === 'chat.history') {
        return {
          success: true,
          message: 'mock history success',
          payload: {
            messages: []
          }
        }
      }

      if (payload.method === 'sessions.list') {
        return {
          success: true,
          message: 'mock sessions list success',
          payload: {
            sessions: sessionsRows
          }
        }
      }

      if (payload.method === 'sessions.patch') {
        const params =
          payload.params && typeof payload.params === 'object' && payload.params !== null
            ? (payload.params as { key?: string; label?: string })
            : undefined

        if (params?.key && typeof params.label === 'string') {
          sessionsRows = sessionsRows.map((session) =>
            session.key === params.key
              ? {
                  ...session,
                  label: params.label
                }
              : session
          )
        }

        return {
          success: true,
          message: 'mock session patch success',
          payload: {
            ok: true
          }
        }
      }

      return {
        success: true,
        message: 'mock request success',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockResolvedValue({
      success: true,
      message: 'mock events success',
      events: []
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByLabelText('对话中心更多操作'))
    fireEvent.click(screen.getByRole('menuitem', { name: '切换会话' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '待改名会话' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '待改名会话 会话操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '修改会话名' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('会话名称'), {
      target: {
        value: '排查 release 通知'
      }
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'sessions.patch',
          params: expect.objectContaining({
            key: 'agent:main:work',
            label: '排查 release 通知'
          })
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '排查 release 通知' })).toBeInTheDocument()
    })
  })

  it('deletes a session from the switch dialog overflow menu', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: null
    })

    let sessionsRows: Array<{
      key: string
      displayName?: string
      updatedAt: number
    }> = [
      {
        key: 'agent:main:main',
        displayName: '主会话',
        updatedAt: 1_763_246_400_000
      },
      {
        key: 'agent:main:work',
        displayName: '工作会话',
        updatedAt: 1_763_246_700_000
      }
    ]

    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async (payload) => {
      if (payload.method === 'chat.subscribe') {
        return {
          success: true,
          message: 'mock subscribe success',
          payload: {}
        }
      }

      if (payload.method === 'chat.history') {
        return {
          success: true,
          message: 'mock history success',
          payload: {
            messages: []
          }
        }
      }

      if (payload.method === 'sessions.list') {
        return {
          success: true,
          message: 'mock sessions list success',
          payload: {
            sessions: sessionsRows
          }
        }
      }

      if (payload.method === 'sessions.delete') {
        const params =
          payload.params && typeof payload.params === 'object' && payload.params !== null
            ? (payload.params as { key?: string })
            : undefined
        if (params?.key) {
          sessionsRows = sessionsRows.filter((session) => session.key !== params.key)
        }

        return {
          success: true,
          message: 'mock session delete success',
          payload: {
            ok: true
          }
        }
      }

      return {
        success: true,
        message: 'mock request success',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockResolvedValue({
      success: true,
      message: 'mock events success',
      events: []
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByLabelText('对话中心更多操作'))
    fireEvent.click(screen.getByRole('menuitem', { name: '切换会话' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '工作会话' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '工作会话 会话操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '删除会话' }))

    await waitFor(() => {
      expect(screen.getByText(/确认删除会话「/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '删除会话' }))

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'sessions.delete',
          params: expect.objectContaining({
            key: 'agent:main:work'
          })
        })
      )
    })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '工作会话' })).not.toBeInTheDocument()
    })
  })

  it('does not allow deleting the main session from the overflow menu', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: null
    })

    let sessionsDeleteCalled = false
    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async (payload) => {
      if (payload.method === 'chat.subscribe') {
        return {
          success: true,
          message: 'mock subscribe success',
          payload: {}
        }
      }

      if (payload.method === 'chat.history') {
        return {
          success: true,
          message: 'mock history success',
          payload: {
            messages: []
          }
        }
      }

      if (payload.method === 'sessions.list') {
        return {
          success: true,
          message: 'mock sessions list success',
          payload: {
            sessions: [
              {
                key: 'agent:main:main',
                displayName: '主会话',
                updatedAt: 1_763_246_400_000
              },
              {
                key: 'agent:main:work',
                displayName: '工作会话',
                updatedAt: 1_763_246_700_000
              }
            ]
          }
        }
      }

      if (payload.method === 'sessions.delete') {
        sessionsDeleteCalled = true
      }

      return {
        success: true,
        message: 'mock request success',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockResolvedValue({
      success: true,
      message: 'mock events success',
      events: []
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByLabelText('对话中心更多操作'))
    fireEvent.click(screen.getByRole('menuitem', { name: '切换会话' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '主会话' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '主会话 会话操作' }))

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: '修改会话名' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('menuitem', { name: '删除会话' })).not.toBeInTheDocument()
    expect(sessionsDeleteCalled).toBe(false)
  })

  it('switches to another session from the overflow menu dialog', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: null
    })

    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async (payload) => {
      if (payload.method === 'chat.subscribe') {
        return {
          success: true,
          message: 'mock subscribe success',
          payload: {}
        }
      }

      if (payload.method === 'chat.history') {
        const requestedSessionKey =
          payload.params && typeof payload.params === 'object' && payload.params !== null
            ? (payload.params as { sessionKey?: string }).sessionKey
            : undefined

        const messages =
          requestedSessionKey === 'agent:main:work'
            ? [
                {
                  id: 'work-history-message-1',
                  role: 'assistant',
                  createdAt: '2026-03-21T08:05:00.000Z',
                  content: [
                    {
                      type: 'text',
                      text: '这里是工作会话里的历史消息'
                    }
                  ]
                }
              ]
            : [
                {
                  id: 'main-history-message-1',
                  role: 'assistant',
                  createdAt: '2026-03-21T08:01:00.000Z',
                  content: [
                    {
                      type: 'text',
                      text: '这里是默认会话里的历史消息'
                    }
                  ]
                }
              ]

        return {
          success: true,
          message: 'mock history success',
          payload: {
            messages
          }
        }
      }

      if (payload.method === 'sessions.list') {
        return {
          success: true,
          message: 'mock sessions list success',
          payload: {
            sessions: [
              {
                key: 'agent:main:main',
                displayName: '主会话',
                updatedAt: 1_763_246_400_000
              },
              {
                key: 'agent:main:work',
                derivedTitle: '工作会话',
                updatedAt: 1_763_246_700_000
              }
            ]
          }
        }
      }

      return {
        success: true,
        message: 'mock request success',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockResolvedValue({
      success: true,
      message: 'mock events success',
      events: []
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('这里是默认会话里的历史消息')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('对话中心更多操作'))
    fireEvent.click(screen.getByRole('menuitem', { name: '切换会话' }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '工作会话' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '工作会话' }))
    fireEvent.click(screen.getByRole('button', { name: '切换会话' }))

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'chat.history',
          params: {
            sessionKey: 'agent:main:work'
          }
        })
      )
    })

    await waitFor(() => {
      expect(screen.queryByText('这里是默认会话里的历史消息')).not.toBeInTheDocument()
      expect(screen.getByText('这里是工作会话里的历史消息')).toBeInTheDocument()
    })
  })

  it('switches session correctly when agent list is available', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: null
    })

    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async (payload) => {
      if (payload.method === 'agents.list') {
        return {
          success: true,
          message: 'mock agents list',
          payload: {
            defaultId: 'main',
            mainKey: 'main',
            scope: 'global',
            agents: [{ id: 'main', name: '主智能体' }]
          }
        }
      }

      if (payload.method === 'chat.subscribe') {
        return {
          success: true,
          message: 'mock subscribe success',
          payload: {}
        }
      }

      if (payload.method === 'chat.history') {
        const requestedSessionKey =
          payload.params && typeof payload.params === 'object' && payload.params !== null
            ? (payload.params as { sessionKey?: string }).sessionKey
            : undefined

        const messages =
          requestedSessionKey === 'agent:main:work'
            ? [
                {
                  id: 'work-history-message-1',
                  role: 'assistant',
                  createdAt: '2026-03-21T08:05:00.000Z',
                  content: [
                    {
                      type: 'text',
                      text: '切换成功：工作会话'
                    }
                  ]
                }
              ]
            : [
                {
                  id: 'main-history-message-1',
                  role: 'assistant',
                  createdAt: '2026-03-21T08:01:00.000Z',
                  content: [
                    {
                      type: 'text',
                      text: '默认：主会话'
                    }
                  ]
                }
              ]

        return {
          success: true,
          message: 'mock history success',
          payload: {
            messages
          }
        }
      }

      if (payload.method === 'sessions.list') {
        return {
          success: true,
          message: 'mock sessions list success',
          payload: {
            sessions: [
              {
                key: 'agent:main:main',
                displayName: '主会话',
                updatedAt: 1_763_246_400_000
              },
              {
                key: 'agent:main:work',
                derivedTitle: '工作会话',
                updatedAt: 1_763_246_700_000
              }
            ]
          }
        }
      }

      return {
        success: true,
        message: 'mock request success',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockResolvedValue({
      success: true,
      message: 'mock events success',
      events: []
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('默认：主会话')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('对话中心更多操作'))
    fireEvent.click(screen.getByRole('menuitem', { name: '切换会话' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '工作会话' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '工作会话' }))
    fireEvent.click(screen.getByRole('button', { name: '切换会话' }))

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'chat.history',
          params: {
            sessionKey: 'agent:main:work'
          }
        })
      )
    })

    await waitFor(() => {
      expect(screen.queryByText('默认：主会话')).not.toBeInTheDocument()
      expect(screen.getByText('切换成功：工作会话')).toBeInTheDocument()
    })
  })

  it('creates scoped session key when creating a new session with selected agent', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: null
    })

    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async (payload) => {
      if (payload.method === 'agents.list') {
        return {
          success: true,
          message: 'mock agents list',
          payload: {
            defaultId: 'main',
            mainKey: 'main',
            scope: 'global',
            agents: [{ id: 'main', name: '主智能体' }]
          }
        }
      }

      if (payload.method === 'chat.subscribe') {
        return {
          success: true,
          message: 'mock subscribe success',
          payload: {}
        }
      }

      if (payload.method === 'chat.history') {
        return {
          success: true,
          message: 'mock history success',
          payload: {
            messages: []
          }
        }
      }

      if (payload.method === 'sessions.patch') {
        return {
          success: true,
          message: 'mock session patch success',
          payload: {
            ok: true
          }
        }
      }

      return {
        success: true,
        message: 'mock request success',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockResolvedValue({
      success: true,
      message: 'mock events success',
      events: []
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText('对话输入框')).toBeEnabled()
    })

    fireEvent.click(screen.getByLabelText('对话中心更多操作'))
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: '创建新会话' })).toBeEnabled()
    })
    fireEvent.click(screen.getByRole('menuitem', { name: '创建新会话' }))

    await waitFor(() => {
      expect(screen.getByLabelText('会话名称')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '创建新会话' }))

    await waitFor(() => {
      const createdSessionHistoryCall = requestGatewayMock.mock.calls.find(([request]) => {
        if (request.method !== 'chat.history') {
          return false
        }

        const sessionKey =
          request.params && typeof request.params === 'object' && request.params !== null
            ? (request.params as { sessionKey?: string }).sessionKey
            : undefined

        return typeof sessionKey === 'string' && /^agent:main:ui:/.test(sessionKey)
      })

      expect(createdSessionHistoryCall).toBeDefined()
    })
  })

  it('shows a reconnect panel for disconnected instances and retries from home', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'disconnected', {
      lastConnectedAt: '2026-03-21T08:00:00.000Z',
      lastError: 'Gateway 已断开'
    })

    const connectGatewayMock = vi.mocked(window.api.connectGateway)
    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async (payload) => {
      if (payload.method === 'chat.history') {
        return {
          success: true,
          message: 'mock history success',
          payload: {
            messages: []
          }
        }
      }

      if (payload.method === 'chat.subscribe') {
        return {
          success: true,
          message: 'mock subscribe success',
          payload: {}
        }
      }

      return {
        success: true,
        message: 'mock request success',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockResolvedValue({
      success: true,
      message: 'mock events success',
      events: []
    })

    let resolveConnect: (() => void) | null = null

    connectGatewayMock.mockImplementation(
      async () =>
        await new Promise((resolve) => {
          resolveConnect = () =>
            resolve({
              success: true,
              message: 'mock gateway connected'
            })
        })
    )

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: '生产集群' })).toBeInTheDocument()
    expect(screen.getByText('当前实例已离线，请重新连接。')).toBeInTheDocument()
    expect(screen.queryByText('连接已断开')).not.toBeInTheDocument()
    expect(screen.queryByText('Gateway 已断开')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新连接' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重新连接' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '重新连接' })).toHaveAttribute('aria-busy', 'true')
      expect(screen.queryByText('连接中')).not.toBeInTheDocument()
      expect(screen.getByText('当前实例已离线，请重新连接。')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(connectGatewayMock).toHaveBeenCalledWith({
        instanceId,
        connection: mockConnectionConfig
      })
    })

    resolveConnect?.()

    await waitFor(() => {
      expect(screen.getByLabelText('对话输入框')).toBeEnabled()
    })
  })
})
