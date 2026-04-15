import { describe, expect, it } from 'vitest'

import {
  getGatewaySessionTitle,
  isGatewayMainSessionKey
} from '../renderer/src/features/chat/lib/gateway-sessions'

describe('getGatewaySessionTitle', () => {
  it('prefers manual label over derived title and display name', () => {
    const title = getGatewaySessionTitle({
      key: 'agent:main:ui:1',
      label: '排查 release 通知',
      derivedTitle: 'Sender (untrusted metadata): ```json {"label":"Open..."}',
      displayName: '默认会话'
    })

    expect(title).toBe('排查 release 通知')
  })

  it('falls back to derived title, then display name, then key', () => {
    expect(
      getGatewaySessionTitle({
        key: 'agent:main:work',
        derivedTitle: '工作会话',
        displayName: '主会话'
      })
    ).toBe('工作会话')

    expect(
      getGatewaySessionTitle({
        key: 'agent:main:main',
        displayName: '主会话'
      })
    ).toBe('主会话')

    expect(
      getGatewaySessionTitle({
        key: 'agent:main:fallback'
      })
    ).toBe('agent:main:fallback')
  })
})

describe('isGatewayMainSessionKey', () => {
  it('returns true for main session aliases', () => {
    expect(isGatewayMainSessionKey('main')).toBe(true)
    expect(isGatewayMainSessionKey('agent:main:main')).toBe(true)
    expect(isGatewayMainSessionKey('AGENT:test:MAIN')).toBe(true)
  })

  it('returns false for non-main session keys', () => {
    expect(isGatewayMainSessionKey('agent:main:work')).toBe(false)
    expect(isGatewayMainSessionKey('ui:1747:abcd')).toBe(false)
    expect(isGatewayMainSessionKey('')).toBe(false)
  })
})
