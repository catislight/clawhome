import { describe, expect, it } from 'vitest'

import {
  buildGatewayRequestCandidates,
  normalizeGatewayPayload,
  type GatewayCapabilities
} from '../renderer/src/shared/api/gateway-capabilities'

const defaultCapabilities: GatewayCapabilities = {
  detectedAt: Date.now(),
  versionRaw: '2026.3.31',
  version: {
    year: 2026,
    month: 3,
    patch: 31
  },
  preferSessionKeyParam: true,
  preferRawConfigSetPayload: true
}

describe('gateway compatibility adapter', () => {
  it('adds key alias candidate for sessionKey-based methods', () => {
    const candidates = buildGatewayRequestCandidates({
      method: 'chat.history',
      params: {
        sessionKey: 'agent:main'
      },
      capabilities: defaultCapabilities
    })

    expect(candidates).toHaveLength(2)
    expect(candidates[0]).toEqual({
      sessionKey: 'agent:main'
    })
    expect(candidates[1]).toEqual({
      sessionKey: 'agent:main',
      key: 'agent:main'
    })
  })

  it('adds jobId alias candidate for cron id-based methods', () => {
    const candidates = buildGatewayRequestCandidates({
      method: 'cron.run',
      params: {
        id: 'job-1',
        mode: 'force'
      },
      capabilities: defaultCapabilities
    })

    expect(candidates).toHaveLength(2)
    expect(candidates[1]).toEqual({
      id: 'job-1',
      mode: 'force',
      jobId: 'job-1'
    })
  })

  it('adds parsed config candidate for config.set raw payload', () => {
    const candidates = buildGatewayRequestCandidates({
      method: 'config.set',
      params: {
        raw: '{"foo":"bar"}',
        baseHash: 'hash-1'
      },
      capabilities: defaultCapabilities
    })

    expect(candidates).toHaveLength(2)
    expect(candidates[1]).toEqual({
      raw: '{"foo":"bar"}',
      baseHash: 'hash-1',
      config: {
        foo: 'bar'
      }
    })
  })

  it('normalizes sessions.list array payload to sessions object', () => {
    const normalized = normalizeGatewayPayload({
      method: 'sessions.list',
      payload: [
        {
          key: 'main',
          label: 'Main'
        }
      ]
    })

    expect(normalized).toEqual({
      sessions: [
        {
          key: 'main',
          label: 'Main'
        }
      ]
    })
  })
})
