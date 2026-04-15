import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingsCenterPage from '../renderer/src/features/settings/pages/settings-center-page'
import type { SshConnectionFormValues } from '../renderer/src/features/instances/model/ssh-connection'
import { createInitialAppStoreState, useAppStore } from '../renderer/src/features/instances/store/use-app-store'

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
  useAppStore.getState().setWorkspaceInstanceId(instanceId)

  return instanceId
}

describe('SettingsCenterPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAppStore.setState(createInitialAppStoreState())
    vi.clearAllMocks()
  })

  it('renders sidebar header with JSON config action and saves full json in right area', async () => {
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
                  workspace: '~/.openclaw/workspace-main'
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
          payload: {
            models: []
          }
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

      return {
        success: true,
        message: 'mock ok',
        payload: {}
      }
    })

    render(
      <MemoryRouter>
        <SettingsCenterPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '配置列表' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'JSON配置' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'JSON配置' }))

    const jsonEditor = await screen.findByRole('textbox')
    fireEvent.change(jsonEditor, {
      target: {
        value: JSON.stringify(
          {
            agents: {
              defaults: {
                workspace: '/tmp/json-workspace'
              }
            },
            tools: {
              profile: 'full'
            }
          },
          null,
          2
        )
      }
    })

    fireEvent.click(screen.getByRole('button', { name: '保存 JSON' }))

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId,
          method: 'config.set'
        })
      )
    })

    await waitFor(() => {
      expect(latestSavedConfig).not.toBeNull()
      expect((latestSavedConfig?.agents as { defaults?: { workspace?: string } })?.defaults?.workspace).toBe(
        '/tmp/json-workspace'
      )
    })
  })
})
