import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SshConnectionFormValues } from '../renderer/src/features/instances/model/ssh-connection'
import AgentsDefaultsConfigPage from '../renderer/src/features/agents/pages/agents-defaults-config-page'
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

describe('AgentsDefaultsConfigPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAppStore.setState(createInitialAppStoreState())
    vi.clearAllMocks()
  })

  it('renders split layout and category header without page header', async () => {
    createConnectedInstance()
    const requestGatewayMock = vi.mocked(window.api.requestGateway)

    requestGatewayMock.mockImplementation(async ({ method }) => {
      if (method === 'config.get') {
        return {
          success: true,
          message: 'mock config get',
          payload: {
            hash: 'hash-1',
            config: {
              agents: {
                defaults: {
                  workspace: '~/.openclaw/workspace-main',
                  repoRoot: '/workspace/project'
                }
              },
              tools: {}
            }
          }
        }
      }

      if (method === 'models.list') {
        return {
          success: true,
          message: 'mock models list',
          payload: {
            models: [
              {
                id: 'openai/gpt-5.4',
                name: 'GPT-5.4',
                provider: 'openai'
              }
            ]
          }
        }
      }

      return { success: true, message: 'mock ok', payload: {} }
    })

    render(
      <MemoryRouter>
        <AgentsDefaultsConfigPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '基础配置' })).toBeInTheDocument()
    })

    expect(screen.queryByText('全局配置')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存配置' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^模型配置/ }))
    expect(screen.getByRole('heading', { name: '模型配置' })).toBeInTheDocument()
    expect(screen.getByText('默认主模型')).toBeInTheDocument()
  })

  it('saves workspace update via config.set', async () => {
    const instanceId = createConnectedInstance()
    const requestGatewayMock = vi.mocked(window.api.requestGateway)

    let latestSavedConfig: Record<string, unknown> | null = null

    requestGatewayMock.mockImplementation(async ({ method, params }) => {
      if (method === 'config.get') {
        return {
          success: true,
          message: 'mock config get',
          payload: {
            hash: 'hash-1',
            config: {
              agents: {
                defaults: {
                  workspace: '~/.openclaw/workspace-main',
                  repoRoot: '/workspace/project'
                }
              },
              tools: {
                profile: 'coding'
              }
            }
          }
        }
      }

      if (method === 'models.list') {
        return {
          success: true,
          message: 'mock models list',
          payload: { models: [] }
        }
      }

      if (method === 'config.set') {
        const raw = (params as { raw?: string }).raw ?? '{}'
        latestSavedConfig = JSON.parse(raw)

        return {
          success: true,
          message: 'mock config set',
          payload: {
            ok: true,
            path: '~/.openclaw/openclaw.json',
            config: latestSavedConfig
          }
        }
      }

      return { success: true, message: 'mock ok', payload: {} }
    })

    render(
      <MemoryRouter initialEntries={[`/agents/defaults?instanceId=${instanceId}`]}>
        <AgentsDefaultsConfigPage />
      </MemoryRouter>
    )

    const workspaceInput = await screen.findByDisplayValue('~/.openclaw/workspace-main')
    fireEvent.change(workspaceInput, {
      target: { value: '/tmp/next-workspace' }
    })

    fireEvent.click(screen.getByRole('button', { name: '保存配置' }))

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'config.set',
          instanceId
        })
      )
    })

    await waitFor(() => {
      expect(latestSavedConfig).not.toBeNull()
      expect((latestSavedConfig?.agents as { defaults?: { workspace?: string } })?.defaults?.workspace).toBe(
        '/tmp/next-workspace'
      )
    })
  })
})
