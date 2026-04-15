import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  connectGateway,
  getGatewayConnectionStatus,
  getAppApiUnavailableMessage,
  requestGateway
} from '../renderer/src/shared/api/app-api'

describe('app-api', () => {
  beforeEach(() => {
    window.api.connectGateway = vi.fn().mockResolvedValue({
      success: true,
      message: 'mock gateway connected'
    })
    window.api.requestGateway = vi.fn().mockResolvedValue({
      success: true,
      message: 'mock request success',
      payload: {}
    })
    window.api.getGatewayConnectionStatus = vi.fn().mockResolvedValue({
      success: true,
      connected: true,
      message: 'mock connected'
    })
  })

  it('routes gateway requests through the shared bridge wrapper', async () => {
    await requestGateway({
      instanceId: 'instance-1',
      method: 'chat.history'
    })

    expect(window.api.requestGateway).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      method: 'chat.history'
    })
  })

  it('routes gateway status checks through the shared bridge wrapper', async () => {
    await getGatewayConnectionStatus({
      instanceId: 'instance-1'
    })

    expect(window.api.getGatewayConnectionStatus).toHaveBeenCalledWith({
      instanceId: 'instance-1'
    })
  })

  it('throws a consistent unavailable error when a bridge method is missing', async () => {
    const originalConnectGateway = window.api.connectGateway
    window.api.connectGateway = undefined as unknown as typeof window.api.connectGateway

    expect(() =>
      connectGateway({
        instanceId: 'instance-1',
        connection: {
          title: 'root@prod',
          port: 22,
          host: '10.0.0.10',
          username: 'root',
          password: 'secret',
          privateKey: 'PRIVATE_KEY'
        }
      })
    ).toThrow(getAppApiUnavailableMessage('connectGateway'))

    window.api.connectGateway = originalConnectGateway
  })
})
