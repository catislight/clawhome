import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SshConnectionFormValues } from '../renderer/src/features/instances/model/ssh-connection'
import OpenClawCronTranscriptPage from '../renderer/src/features/cron/pages/openclaw-cron-transcript-page'
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
    lastConnectedAt: '2026-03-24T08:00:00.000Z',
    lastError: null
  })

  return instanceId
}

describe('OpenClawCronTranscriptPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAppStore.setState(createInitialAppStoreState())
    vi.clearAllMocks()
  })

  it('shows assistant output only and keeps the transcript read-only', async () => {
    const instanceId = createConnectedInstance()
    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async ({ method }) => {
      if (method === 'chat.subscribe') {
        return {
          success: true,
          message: 'subscribed',
          payload: {}
        }
      }

      if (method === 'cron.runs') {
        return {
          success: true,
          message: 'runs loaded',
          payload: {
            entries: [
              {
                ts: 1_772_000_010_000,
                jobId: 'job-1',
                action: 'finished',
                status: 'ok',
                sessionKey: 'agent:main:cron:job-1:run:run-1'
              }
            ],
            total: 1,
            offset: 0,
            limit: 10,
            hasMore: false,
            nextOffset: null
          }
        }
      }

      if (method === 'chat.history') {
        return {
          success: true,
          message: 'history loaded',
          payload: {
            messages: [
              {
                id: 'msg-user-1',
                role: 'user',
                text: '请汇总今天的状态',
                createdAt: '2026-03-24T08:00:00.000Z'
              },
              {
                id: 'msg-assistant-1',
                role: 'assistant',
                text: '今天共有 2 个异常，需要优先处理。',
                createdAt: '2026-03-24T08:00:10.000Z'
              }
            ]
          }
        }
      }

      return {
        success: true,
        message: 'unused',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockResolvedValue({
      success: true,
      message: 'events loaded',
      events: []
    })

    render(
      <MemoryRouter initialEntries={[`/cron/transcript?instanceId=${instanceId}&jobId=job-1`]}>
        <OpenClawCronTranscriptPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('今天共有 2 个异常，需要优先处理。')).toBeInTheDocument()
    })

    expect(screen.queryByText('请汇总今天的状态')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('对话输入框')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '返回任务列表' })).toBeInTheDocument()
  })

  it('shows multiple historical outputs from different runs', async () => {
    const instanceId = createConnectedInstance()
    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const pullGatewayEventsMock = vi.mocked(window.api.pullGatewayEvents)

    requestGatewayMock.mockImplementation(async ({ method, params }) => {
      if (method === 'cron.runs') {
        return {
          success: true,
          message: 'runs loaded',
          payload: {
            entries: [
              {
                ts: 1_772_000_020_000,
                jobId: 'job-1',
                action: 'finished',
                status: 'ok',
                sessionKey: 'agent:main:cron:job-1:run:run-new'
              },
              {
                ts: 1_772_000_000_000,
                jobId: 'job-1',
                action: 'finished',
                status: 'ok',
                sessionKey: 'agent:main:cron:job-1:run:run-old'
              }
            ],
            total: 2,
            offset: 0,
            limit: 10,
            hasMore: false,
            nextOffset: null
          }
        }
      }

      if (method === 'chat.history') {
        const sessionKey = (params as { sessionKey?: string } | undefined)?.sessionKey
        if (sessionKey === 'agent:main:cron:job-1:run:run-new') {
          return {
            success: true,
            message: 'history loaded',
            payload: {
              messages: [
                {
                  id: 'assistant-new',
                  role: 'assistant',
                  text: '这是最新一次运行结果。',
                  createdAt: '2026-03-24T09:00:00.000Z'
                }
              ]
            }
          }
        }

        if (sessionKey === 'agent:main:cron:job-1:run:run-old') {
          return {
            success: true,
            message: 'history loaded',
            payload: {
              messages: [
                {
                  id: 'assistant-old',
                  role: 'assistant',
                  text: '这是更早一次运行结果。',
                  createdAt: '2026-03-24T08:00:00.000Z'
                }
              ]
            }
          }
        }
      }

      return {
        success: true,
        message: 'unused',
        payload: {}
      }
    })

    pullGatewayEventsMock.mockResolvedValue({
      success: true,
      message: 'events loaded',
      events: []
    })

    render(
      <MemoryRouter initialEntries={[`/cron/transcript?instanceId=${instanceId}&jobId=job-1`]}>
        <OpenClawCronTranscriptPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('这是最新一次运行结果。')).toBeInTheDocument()
    })

    expect(screen.getByText('这是更早一次运行结果。')).toBeInTheDocument()
  })
})
