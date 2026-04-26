import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  connectGateway,
  loadChatConversationSnapshot,
  getGatewayConnectionStatus,
  getAppApiUnavailableMessage,
  requestGateway,
  saveChatConversationSnapshot
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
    window.api.saveChatConversationSnapshot = vi.fn().mockResolvedValue({
      success: true,
      message: 'mock chat snapshot saved'
    })
    window.api.loadChatConversationSnapshot = vi.fn().mockResolvedValue({
      success: true,
      message: 'mock chat snapshot loaded',
      snapshot: null
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

  it('routes chat snapshot persistence calls through shared bridge wrappers', async () => {
    await saveChatConversationSnapshot({
      instanceId: 'instance-1',
      sessionKey: 'main',
      snapshot: {
        updatedAt: 1,
        messages: [],
        runTraces: []
      }
    })

    await loadChatConversationSnapshot({
      instanceId: 'instance-1',
      sessionKey: 'main'
    })

    expect(window.api.saveChatConversationSnapshot).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      sessionKey: 'main',
      snapshot: {
        updatedAt: 1,
        messages: [],
        runTraces: []
      }
    })

    expect(window.api.loadChatConversationSnapshot).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      sessionKey: 'main'
    })
  })
})
