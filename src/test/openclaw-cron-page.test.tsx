import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SshConnectionFormValues } from '../renderer/src/features/instances/model/ssh-connection'
import OpenClawCronPage from '../renderer/src/features/cron/pages/openclaw-cron-page'
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

function createDisconnectedInstance(): string {
  const instanceId = useAppStore.getState().createOpenClawInstance({
    name: '腾讯云',
    description: '通用场景'
  })

  useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
  useAppStore.getState().setConnectionState(instanceId, 'disconnected', {
    lastConnectedAt: '2026-03-24T08:00:00.000Z',
    lastError: '与 OpenClaw 的连接已断开，请重新连接。'
  })

  return instanceId
}

describe('OpenClawCronPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAppStore.setState(createInitialAppStoreState())
    vi.clearAllMocks()
  })

  it('reuses the instance connection card when the selected instance is not connected', () => {
    const instanceId = createDisconnectedInstance()

    render(
      <MemoryRouter initialEntries={[`/cron?instanceId=${instanceId}`]}>
        <OpenClawCronPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: '腾讯云' })).toBeInTheDocument()
    expect(screen.getByText('已断开')).toBeInTheDocument()
    expect(screen.getByText('连接当前实例后，才能管理定时任务。')).toBeInTheDocument()
    expect(screen.getByText('root@10.0.0.10:22')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '实例管理' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新连接' })).toBeInTheDocument()
    expect(screen.queryByText('先连接当前实例')).not.toBeInTheDocument()
  })

  it('loads cron jobs for the selected connected instance and renders them in sidebar + content layout', async () => {
    const instanceId = createConnectedInstance()
    const requestGatewayMock = vi.mocked(window.api.requestGateway)

    requestGatewayMock.mockImplementation(async ({ method }) => {
      if (method === 'cron.status') {
        return {
          success: true,
          message: 'mock cron status',
          payload: {
            enabled: true,
            jobs: 1,
            nextWakeAtMs: 1_772_000_000_000
          }
        }
      }

      if (method === 'cron.list') {
        return {
          success: true,
          message: 'mock cron list',
          payload: {
            jobs: [
              {
                id: 'job-1',
                name: '每天巡检',
                description: '检查线上实例状态',
                enabled: true,
                createdAtMs: 1_772_000_000_000,
                updatedAtMs: 1_772_000_000_000,
                schedule: {
                  kind: 'every',
                  everyMs: 3_600_000
                },
                sessionTarget: 'isolated',
                wakeMode: 'now',
                payload: {
                  kind: 'agentTurn',
                  message: '巡检生产集群并汇总异常'
                },
                delivery: {
                  mode: 'announce',
                  channel: 'last'
                },
                state: {
                  nextRunAtMs: 1_772_000_000_000,
                  lastRunAtMs: 1_771_996_400_000,
                  lastStatus: 'error',
                  lastDeliveryStatus: 'unknown',
                  lastError: 'Channel is required (no configured channels detected).'
                }
              }
            ]
          }
        }
      }

      if (method === 'chat.history') {
        return {
          success: true,
          message: 'mock history',
          payload: {
            messages: [
              {
                id: 'assistant-1',
                role: 'assistant',
                text: '已完成版本检查并写回状态文件。',
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

    render(
      <MemoryRouter initialEntries={[`/cron?instanceId=${instanceId}`]}>
        <OpenClawCronPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('每天巡检').length).toBeGreaterThan(0)
    })

    expect(screen.queryByText('检查线上实例状态')).not.toBeInTheDocument()
    expect(screen.queryByText('调度器')).not.toBeInTheDocument()
    expect(screen.getByText('最近成功')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('已完成版本检查并写回状态文件。')).toBeInTheDocument()
    })
    expect(requestGatewayMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId,
        method: 'cron.status'
      })
    )
    expect(requestGatewayMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId,
        method: 'cron.list'
      })
    )
    expect(screen.getByRole('button', { name: '配置' })).toBeInTheDocument()
  })

  it('submits cron.add payloads when creating a new cron job', async () => {
    const instanceId = createConnectedInstance()
    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    let submittedAddPayload: unknown = null

    requestGatewayMock.mockImplementation(async ({ method, params }) => {
      if (method === 'cron.status') {
        return {
          success: true,
          message: 'mock cron status',
          payload: {
            enabled: true,
            jobs: 0
          }
        }
      }

      if (method === 'cron.list') {
        return {
          success: true,
          message: 'mock cron list',
          payload: {
            jobs: []
          }
        }
      }

      if (method === 'cron.add') {
        submittedAddPayload = params

        return {
          success: true,
          message: 'mock cron add',
          payload: {
            id: 'job-new',
            name: '每日摘要',
            enabled: true,
            createdAtMs: 1_772_000_000_000,
            updatedAtMs: 1_772_000_000_000,
            schedule: {
              kind: 'every',
              everyMs: 3_600_000
            },
            sessionTarget: 'isolated',
            wakeMode: 'now',
            payload: {
              kind: 'agentTurn',
              message: '生成今天的巡检摘要'
            },
            delivery: {
              mode: 'announce',
              channel: 'last'
            },
            state: {}
          }
        }
      }

      return {
        success: true,
        message: 'unused',
        payload: {}
      }
    })

    render(
      <MemoryRouter initialEntries={[`/cron?instanceId=${instanceId}`]}>
        <OpenClawCronPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('还没有定时任务')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '新建定时任务' }))
    fireEvent.change(screen.getByLabelText('任务名称'), {
      target: { value: '每日摘要' }
    })
    fireEvent.change(screen.getByLabelText('执行内容'), {
      target: { value: '生成今天的巡检摘要' }
    })
    fireEvent.click(screen.getByRole('button', { name: '创建任务' }))

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId,
          method: 'cron.add'
        })
      )
    })

    expect(submittedAddPayload).toMatchObject({
      name: '每日摘要',
      enabled: true,
      sessionTarget: 'isolated',
      wakeMode: 'now',
      schedule: {
        kind: 'every',
        everyMs: 3_600_000
      },
      payload: {
        kind: 'agentTurn',
        message: '生成今天的巡检摘要'
      },
      delivery: {
        mode: 'announce',
        channel: 'last'
      }
    })
  })

  it('shows selected job output directly in the content area', async () => {
    const instanceId = createConnectedInstance()
    const requestGatewayMock = vi.mocked(window.api.requestGateway)

    requestGatewayMock.mockImplementation(async ({ method }) => {
      if (method === 'cron.status') {
        return {
          success: true,
          message: 'mock cron status',
          payload: {
            enabled: true,
            jobs: 1
          }
        }
      }

      if (method === 'cron.list') {
        return {
          success: true,
          message: 'mock cron list',
          payload: {
            jobs: [
              {
                id: 'job-42',
                name: '每小时巡检',
                enabled: true,
                createdAtMs: 1_772_000_000_000,
                updatedAtMs: 1_772_000_000_000,
                schedule: {
                  kind: 'every',
                  everyMs: 3_600_000
                },
                sessionTarget: 'isolated',
                wakeMode: 'now',
                payload: {
                  kind: 'agentTurn',
                  message: '汇总实例状态'
                },
                delivery: {
                  mode: 'announce',
                  channel: 'last'
                },
                state: {}
              }
            ]
          }
        }
      }

      if (method === 'chat.history') {
        return {
          success: true,
          message: 'mock history',
          payload: {
            messages: [
              {
                id: 'assistant-42',
                role: 'assistant',
                text: '内嵌输出面板已加载。',
                createdAt: '2026-03-24T08:12:00.000Z'
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

    render(
      <MemoryRouter initialEntries={[`/cron?instanceId=${instanceId}`]}>
        <OpenClawCronPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('内嵌输出面板已加载。')).toBeInTheDocument()
    })
  })

  it('supports run/edit/delete actions from each cron item overflow menu', async () => {
    const instanceId = createConnectedInstance()
    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true)

    requestGatewayMock.mockImplementation(async ({ method }) => {
      if (method === 'cron.status') {
        return {
          success: true,
          message: 'mock cron status',
          payload: {
            enabled: true,
            jobs: 1
          }
        }
      }

      if (method === 'cron.list') {
        return {
          success: true,
          message: 'mock cron list',
          payload: {
            jobs: [
              {
                id: 'job-menu-1',
                name: 'Watch OpenClaw releases',
                enabled: true,
                createdAtMs: 1_772_000_000_000,
                updatedAtMs: 1_772_000_000_000,
                schedule: {
                  kind: 'every',
                  everyMs: 3_600_000
                },
                sessionTarget: 'isolated',
                wakeMode: 'now',
                payload: {
                  kind: 'agentTurn',
                  message: '检查是否有新版本发布'
                },
                delivery: {
                  mode: 'announce',
                  channel: 'last'
                },
                state: {}
              }
            ]
          }
        }
      }

      if (method === 'cron.runs') {
        return {
          success: true,
          message: 'mock runs',
          payload: {
            entries: [],
            total: 0,
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
          message: 'mock history',
          payload: {
            messages: []
          }
        }
      }

      if (method === 'cron.run') {
        return {
          success: true,
          message: 'mock run',
          payload: {
            ok: true,
            enqueued: true,
            runId: 'run-1'
          }
        }
      }

      if (method === 'cron.remove') {
        return {
          success: true,
          message: 'mock remove',
          payload: {
            ok: true,
            removed: true
          }
        }
      }

      return {
        success: true,
        message: 'unused',
        payload: {}
      }
    })

    render(
      <MemoryRouter initialEntries={[`/cron?instanceId=${instanceId}`]}>
        <OpenClawCronPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Watch OpenClaw releases').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Watch OpenClaw releases 更多操作' }))
    expect(screen.getByRole('menuitem', { name: '运行任务' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '编辑配置' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '删除任务' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: '编辑配置' }))
    expect(screen.getByRole('heading', { name: '配置定时任务' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    fireEvent.click(screen.getByRole('button', { name: 'Watch OpenClaw releases 更多操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '运行任务' }))
    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId,
          method: 'cron.run',
          params: expect.objectContaining({ id: 'job-menu-1' })
        })
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Watch OpenClaw releases 更多操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '删除任务' }))
    expect(confirmMock).toHaveBeenCalledWith('确认删除任务「Watch OpenClaw releases」吗？')
    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId,
          method: 'cron.remove',
          params: expect.objectContaining({ id: 'job-menu-1' })
        })
      )
    })
  })

  it('refreshes run history after manual run completion without remount', async () => {
    vi.useFakeTimers()

    try {
      const instanceId = createConnectedInstance()
      const requestGatewayMock = vi.mocked(window.api.requestGateway)
      let runTriggeredAtMs: number | null = null
      let hasRecentOutput = false
      let listCallCount = 0

      requestGatewayMock.mockImplementation(async ({ method, params }) => {
        if (method === 'cron.status') {
          return {
            success: true,
            message: 'status ok',
            payload: {
              enabled: true,
              jobs: 1
            }
          }
        }

        if (method === 'cron.list') {
          listCallCount += 1

          return {
            success: true,
            message: 'list ok',
            payload: {
              jobs: [
                {
                  id: 'job-live-history',
                  name: '实时输出任务',
                  enabled: true,
                  createdAtMs: 1_772_000_000_000,
                  updatedAtMs: 1_772_000_000_000,
                  schedule: {
                    kind: 'every',
                    everyMs: 3_600_000
                  },
                  sessionTarget: 'isolated',
                  wakeMode: 'now',
                  payload: {
                    kind: 'agentTurn',
                    message: '输出最近一次执行结果'
                  },
                  delivery: {
                    mode: 'announce',
                    channel: 'last'
                  },
                  state:
                    runTriggeredAtMs === null
                      ? {}
                      : listCallCount < 4
                        ? {
                            runningAtMs: runTriggeredAtMs
                          }
                        : {
                            lastStatus: 'ok',
                            lastRunAtMs: runTriggeredAtMs
                          }
                }
              ]
            }
          }
        }

        if (method === 'cron.runs') {
          if (runTriggeredAtMs === null || listCallCount < 4) {
            return {
              success: true,
              message: 'runs empty',
              payload: {
                entries: [],
                total: 0,
                offset: 0,
                limit: 10,
                hasMore: false,
                nextOffset: null
              }
            }
          }

          return {
            success: true,
            message: 'runs ok',
            payload: {
              entries: [
                {
                  ts: runTriggeredAtMs,
                  jobId: 'job-live-history',
                  action: 'finished',
                  status: 'ok',
                  runAtMs: runTriggeredAtMs,
                  durationMs: 1_500,
                  sessionKey: 'agent:main:cron:job-live-history:run:1'
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
          const sessionKey =
            typeof params === 'object' && params !== null && 'sessionKey' in params
              ? (params as { sessionKey?: string }).sessionKey
              : undefined

          if (sessionKey === 'cron:job-live-history') {
            return {
              success: true,
              message: 'job output ready state',
              payload: {
                messages: hasRecentOutput
                  ? [
                      {
                        id: 'assistant-job-output-ready',
                        role: 'assistant',
                        text: 'recent output ready',
                        createdAt: '2026-03-31T10:00:00.000Z'
                      }
                    ]
                  : []
              }
            }
          }

          if (sessionKey === 'agent:main:cron:job-live-history:run:1') {
            return {
              success: true,
              message: 'run history output',
              payload: {
                messages: hasRecentOutput
                  ? [
                      {
                        id: 'assistant-run-history-latest',
                        role: 'assistant',
                        text: '最新运行输出：巡检完成。',
                        createdAt: '2026-03-31T10:00:00.000Z'
                      }
                    ]
                  : []
              }
            }
          }

          return {
            success: true,
            message: 'history fallback',
            payload: {
              messages: []
            }
          }
        }

        if (method === 'cron.run') {
          runTriggeredAtMs = Date.now()
          window.setTimeout(() => {
            hasRecentOutput = true
          }, 2_500)

          return {
            success: true,
            message: 'run queued',
            payload: {
              ok: true
            }
          }
        }

        return {
          success: true,
          message: 'unused',
          payload: {}
        }
      })

      render(
        <MemoryRouter initialEntries={[`/cron?instanceId=${instanceId}`]}>
          <OpenClawCronPage />
        </MemoryRouter>
      )

      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(screen.getByText('当前任务还没有输出')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '运行' }))

      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(8_000)
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(screen.getByText('最新运行输出：巡检完成。')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps visible run feedback while follow-up syncs are pending', async () => {
    vi.useFakeTimers()

    try {
      const instanceId = createConnectedInstance()
      const requestGatewayMock = vi.mocked(window.api.requestGateway)
      let statusCallCount = 0
      let listCallCount = 0

      requestGatewayMock.mockImplementation(async ({ method }) => {
        if (method === 'cron.status') {
          statusCallCount += 1

          return {
            success: true,
            message: 'status ok',
            payload: {
              enabled: true,
              jobs: 1
            }
          }
        }

        if (method === 'cron.list') {
          listCallCount += 1

          return {
            success: true,
            message: 'list ok',
            payload: {
              jobs: [
                {
                  id: 'job-run',
                  name: '手动巡检',
                  enabled: true,
                  createdAtMs: 1_772_000_000_000,
                  updatedAtMs: 1_772_000_000_000,
                  schedule: {
                    kind: 'every',
                    everyMs: 3_600_000
                  },
                  sessionTarget: 'isolated',
                  wakeMode: 'now',
                  payload: {
                    kind: 'agentTurn',
                    message: '巡检当前实例'
                  },
                  delivery: {
                    mode: 'announce',
                    channel: 'last'
                  },
                  state: {
                    lastStatus: listCallCount >= 4 ? 'ok' : undefined,
                    lastRunAtMs: listCallCount >= 4 ? Date.now() : undefined
                  }
                }
              ]
            }
          }
        }

        if (method === 'chat.history') {
          return {
            success: true,
            message: 'history ok',
            payload: {
              messages:
                listCallCount >= 4
                  ? [
                      {
                        id: 'assistant-complete',
                        role: 'assistant',
                        text: '巡检完成，发现 0 个阻塞问题。',
                        createdAt: '2026-03-24T08:10:00.000Z'
                      }
                    ]
                  : []
            }
          }
        }

        if (method === 'cron.run') {
          return {
            success: true,
            message: 'run queued',
            payload: {}
          }
        }

        return {
          success: true,
          message: 'unused',
          payload: {}
        }
      })

      render(
        <MemoryRouter initialEntries={[`/cron?instanceId=${instanceId}`]}>
          <OpenClawCronPage />
        </MemoryRouter>
      )

      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(screen.getAllByText('手动巡检').length).toBeGreaterThan(0)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '运行' }))
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(screen.getAllByText('运行中').length).toBeGreaterThan(0)
      expect(screen.getByRole('button', { name: '等待状态...' })).toBeDisabled()
      expect(screen.getByRole('button', { name: '配置' })).toBeEnabled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_600)
        await Promise.resolve()
      })

      expect(screen.getByText('最近成功')).toBeInTheDocument()

      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId,
          method: 'cron.run'
        })
      )
      expect(statusCallCount).toBeGreaterThanOrEqual(4)
      expect(listCallCount).toBeGreaterThanOrEqual(4)
    } finally {
      vi.useRealTimers()
    }
  })

  it('restores manual-run tracking after remount and refreshes to completion', async () => {
    vi.useFakeTimers()

    try {
      const instanceId = createConnectedInstance()
      const requestGatewayMock = vi.mocked(window.api.requestGateway)
      let statusCallCount = 0
      let listCallCount = 0

      requestGatewayMock.mockImplementation(async ({ method }) => {
        if (method === 'cron.status') {
          statusCallCount += 1

          return {
            success: true,
            message: 'status ok',
            payload: {
              enabled: true,
              jobs: 1
            }
          }
        }

        if (method === 'cron.list') {
          listCallCount += 1

          return {
            success: true,
            message: 'list ok',
            payload: {
              jobs: [
                {
                  id: 'job-remount',
                  name: 'Remount 巡检',
                  enabled: true,
                  createdAtMs: 1_772_000_000_000,
                  updatedAtMs: 1_772_000_000_000,
                  schedule: {
                    kind: 'every',
                    everyMs: 3_600_000
                  },
                  sessionTarget: 'isolated',
                  wakeMode: 'now',
                  payload: {
                    kind: 'agentTurn',
                    message: '切页后继续追踪运行状态'
                  },
                  delivery: {
                    mode: 'announce',
                    channel: 'last'
                  },
                  state: {
                    runningAtMs: listCallCount < 3 ? Date.now() : undefined,
                    lastStatus: listCallCount >= 4 ? 'ok' : undefined,
                    lastRunAtMs: listCallCount >= 4 ? Date.now() : undefined
                  }
                }
              ]
            }
          }
        }

        if (method === 'chat.history') {
          return {
            success: true,
            message: 'history ok',
            payload: {
              messages:
                listCallCount >= 4
                  ? [
                      {
                        id: 'assistant-complete-remount',
                        role: 'assistant',
                        text: '切页回来后已经同步到最终结果。',
                        createdAt: '2026-03-24T08:20:00.000Z'
                      }
                    ]
                  : []
            }
          }
        }

        if (method === 'cron.run') {
          return {
            success: true,
            message: 'run queued',
            payload: {}
          }
        }

        return {
          success: true,
          message: 'unused',
          payload: {}
        }
      })

      const initialRender = render(
        <MemoryRouter initialEntries={[`/cron?instanceId=${instanceId}`]}>
          <OpenClawCronPage />
        </MemoryRouter>
      )

      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      fireEvent.click(screen.getByRole('button', { name: '运行' }))

      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(screen.getAllByText('运行中').length).toBeGreaterThan(0)

      initialRender.unmount()

      render(
        <MemoryRouter initialEntries={[`/cron?instanceId=${instanceId}`]}>
          <OpenClawCronPage />
        </MemoryRouter>
      )

      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(
        screen.queryByRole('button', { name: '等待状态...' }) ??
          screen.queryAllByText('最近成功')[0]
      ).toBeTruthy()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(4_500)
        await Promise.resolve()
      })

      expect(screen.getAllByText('最近成功').length).toBeGreaterThan(0)
      expect(statusCallCount).toBeGreaterThanOrEqual(4)
      expect(listCallCount).toBeGreaterThanOrEqual(4)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not keep manual-run syncing when the run started before delayed follow-up scheduling', async () => {
    vi.useFakeTimers()

    try {
      const instanceId = createConnectedInstance()
      const requestGatewayMock = vi.mocked(window.api.requestGateway)
      let runStartedAtMs: number | null = null

      requestGatewayMock.mockImplementation(async ({ method }) => {
        if (method === 'cron.status') {
          if (runStartedAtMs !== null) {
            await new Promise<void>((resolve) => {
              window.setTimeout(() => resolve(), 800)
            })
          }

          return {
            success: true,
            message: 'status ok',
            payload: {
              enabled: true,
              jobs: 1
            }
          }
        }

        if (method === 'cron.list') {
          if (runStartedAtMs !== null) {
            await new Promise<void>((resolve) => {
              window.setTimeout(() => resolve(), 800)
            })
          }

          return {
            success: true,
            message: 'list ok',
            payload: {
              jobs: [
                {
                  id: 'job-fast-complete',
                  name: '快速完成任务',
                  enabled: true,
                  createdAtMs: 1_772_000_000_000,
                  updatedAtMs: 1_772_000_000_000,
                  schedule: {
                    kind: 'every',
                    everyMs: 3_600_000
                  },
                  sessionTarget: 'isolated',
                  wakeMode: 'now',
                  payload: {
                    kind: 'agentTurn',
                    message: '输出完成后应尽快更新状态'
                  },
                  delivery: {
                    mode: 'announce',
                    channel: 'last'
                  },
                  state:
                    runStartedAtMs === null
                      ? {}
                      : {
                          lastStatus: 'ok',
                          lastRunAtMs: runStartedAtMs
                        }
                }
              ]
            }
          }
        }

        if (method === 'chat.history') {
          return {
            success: true,
            message: 'history ok',
            payload: {
              messages:
                runStartedAtMs === null
                  ? []
                  : [
                      {
                        id: 'assistant-fast-complete',
                        role: 'assistant',
                        text: '任务输出已完成。',
                        createdAt: '2026-03-31T10:00:00.000Z'
                      }
                    ]
            }
          }
        }

        if (method === 'cron.run') {
          runStartedAtMs = Date.now()
          return {
            success: true,
            message: 'run queued',
            payload: {}
          }
        }

        return {
          success: true,
          message: 'unused',
          payload: {}
        }
      })

      render(
        <MemoryRouter initialEntries={[`/cron?instanceId=${instanceId}`]}>
          <OpenClawCronPage />
        </MemoryRouter>
      )

      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      fireEvent.click(screen.getByRole('button', { name: '运行' }))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6_000)
        await Promise.resolve()
      })

      expect(screen.queryByRole('button', { name: '等待状态...' })).not.toBeInTheDocument()
      expect(screen.getAllByText('最近成功').length).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
