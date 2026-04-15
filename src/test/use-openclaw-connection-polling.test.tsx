import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SshConnectionFormValues } from '../renderer/src/features/instances/model/ssh-connection'
import {
  OPENCLAW_CONNECTION_POLL_INTERVAL_MS,
  OPENCLAW_UNEXPECTED_DISCONNECT_MESSAGE
} from '../renderer/src/features/instances/lib/openclaw-connection-state'
import { useOpenClawConnectionPolling } from '../renderer/src/features/instances/lib/use-openclaw-connection-polling'
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

function ConnectionPollingHarness(): React.JSX.Element | null {
  useOpenClawConnectionPolling()
  return null
}

describe('useOpenClawConnectionPolling', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAppStore.setState(createInitialAppStoreState())
    vi.clearAllMocks()
  })

  it('marks connected instances as disconnected when status polling detects a drop', async () => {
    vi.useFakeTimers()

    try {
      const instanceId = useAppStore.getState().createOpenClawInstance({
        name: '生产集群',
        description: '线上环境'
      })

      useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
      useAppStore.getState().setConnectionState(instanceId, 'connected', {
        lastConnectedAt: '2026-03-21T08:00:00.000Z',
        lastError: null
      })

      const statusMock = vi.mocked(window.api.getGatewayConnectionStatus)
      let connected = true

      statusMock.mockImplementation(async () => ({
        success: true,
        connected,
        message: connected ? 'Gateway 已连接' : ''
      }))

      render(<ConnectionPollingHarness />)

      await act(async () => {
        await Promise.resolve()
      })

      expect(statusMock).toHaveBeenCalledWith({
        instanceId
      })

      connected = false

      await act(async () => {
        await vi.advanceTimersByTimeAsync(OPENCLAW_CONNECTION_POLL_INTERVAL_MS + 50)
      })

      const instance = useAppStore.getState().instances.find((item) => item.id === instanceId)

      expect(instance?.connectionState).toBe('disconnected')
      expect(instance?.lastError).toBe(OPENCLAW_UNEXPECTED_DISCONNECT_MESSAGE)
    } finally {
      vi.useRealTimers()
    }
  })
})
