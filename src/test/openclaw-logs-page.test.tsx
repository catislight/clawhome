import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SshConnectionFormValues } from '../renderer/src/features/instances/model/ssh-connection'
import OpenClawLogsPage from '../renderer/src/features/logs/pages/openclaw-logs-page'
import {
  createInitialAppStoreState,
  useAppStore
} from '../renderer/src/features/instances/store/use-app-store'

const mockConnectionConfig: SshConnectionFormValues = {
  title: 'root@prod',
  port: 22,
  host: '10.0.0.10',
  username: 'root',
  password: 'secret',
  privateKey: 'PRIVATE_KEY',
  privateKeyPassphrase: ''
}

function createConnectedInstance(): string {
  const instanceId = useAppStore.getState().createOpenClawInstance({
    name: '生产集群',
    description: '线上环境'
  })

  useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
  useAppStore.getState().setConnectionState(instanceId, 'connected', {
    lastConnectedAt: '2026-04-11T12:00:00.000Z',
    lastError: null
  })
  useAppStore.getState().setWorkspaceInstanceId(instanceId)

  return instanceId
}

describe('OpenClawLogsPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAppStore.setState(createInitialAppStoreState())
    vi.clearAllMocks()
  })

  it('renders no-instance state when there is no configured instance', () => {
    render(
      <MemoryRouter>
        <OpenClawLogsPage />
      </MemoryRouter>
    )

    expect(screen.getByText('暂无实例，')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '去创建' })).toBeInTheDocument()
  })

  it('loads logs and supports filtering and clearing', async () => {
    const instanceId = createConnectedInstance()
    const listDebugLogsMock = vi.mocked(window.api.listGatewayDebugLogs)
    const clearDebugLogsMock = vi.mocked(window.api.clearGatewayDebugLogs)
    let currentLogs = [
      {
        id: 'log-noise-tick',
        level: 'info' as const,
        kind: 'event' as const,
        source: 'tick',
        message: '收到事件：tick',
        requestId: undefined,
        payloadText: '{"heartbeat":true}',
        receivedAt: '2026-04-11T12:01:04.120Z'
      },
      {
        id: 'log-noise-health',
        level: 'info' as const,
        kind: 'event' as const,
        source: 'openclaw.health',
        message: '收到事件：openclaw.health',
        requestId: undefined,
        payloadText: '{"status":"ok"}',
        receivedAt: '2026-04-11T12:01:03.120Z'
      },
      {
        id: 'log-1',
        level: 'error' as const,
        kind: 'event' as const,
        source: 'chat',
        message: '收到事件：chat.error',
        requestId: undefined,
        payloadText: '{"runId":"run-error"}',
        receivedAt: '2026-04-11T12:01:02.120Z'
      },
      {
        id: 'log-2',
        level: 'info' as const,
        kind: 'request' as const,
        source: 'chat.send',
        message: '发送请求：chat.send',
        requestId: 'req-2',
        payloadText: '{"text":"hello"}',
        receivedAt: '2026-04-11T12:01:01.120Z'
      }
    ]

    listDebugLogsMock.mockImplementation(async (payload) => {
      if (payload.instanceId !== instanceId) {
        return {
          success: true,
          message: 'ok',
          logs: []
        }
      }

      return {
        success: true,
        message: 'ok',
        logs: currentLogs
      }
    })
    clearDebugLogsMock.mockImplementation(async () => {
      const clearedCount = currentLogs.length
      currentLogs = []

      return {
        success: true,
        message: 'cleared',
        clearedCount
      }
    })

    render(
      <MemoryRouter initialEntries={[`/logs?instanceId=${instanceId}`]}>
        <OpenClawLogsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('收到事件：chat.error')).toBeInTheDocument()
      expect(screen.getByText('发送请求：chat.send')).toBeInTheDocument()
      expect(screen.queryByText('收到事件：tick')).not.toBeInTheDocument()
      expect(screen.queryByText('收到事件：openclaw.health')).not.toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('按来源、消息或 payload 关键字筛选'), {
      target: {
        value: 'chat.error'
      }
    })

    expect(screen.getByText('收到事件：chat.error')).toBeInTheDocument()
    expect(screen.queryByText('发送请求：chat.send')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '清空日志' }))

    await waitFor(() => {
      expect(clearDebugLogsMock).toHaveBeenCalledWith({
        instanceId
      })
      expect(listDebugLogsMock).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByText('暂无日志')).toBeInTheDocument()
    })
  })
})
