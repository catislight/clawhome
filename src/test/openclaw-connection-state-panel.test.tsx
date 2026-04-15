import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import OpenClawConnectionStatePanel from '../renderer/src/features/instances/components/openclaw-connection-state-panel'
import type { OpenClawInstance } from '../renderer/src/features/instances/store/use-app-store'

function createInstance(partial: Partial<OpenClawInstance>): OpenClawInstance {
  return {
    id: 'openclaw-test',
    name: '腾讯云',
    description: '通用场景',
    createdAt: '2026-03-20T08:00:00.000Z',
    updatedAt: '2026-03-20T08:00:00.000Z',
    connectionConfig: {
      title: '腾讯云',
      port: 22,
      host: '175.178.126.189',
      username: 'openclaw',
      password: 'secret',
      privateKey: 'PRIVATE_KEY',
      privateKeyPassphrase: ''
    },
    connectionState: 'disconnected',
    lastConnectedAt: '2026-03-20T08:44:15.000Z',
    lastError: '与 OpenClaw 的连接已断开，请重新连接。',
    ...partial
  }
}

describe('OpenClawConnectionStatePanel', () => {
  it('keeps the disconnected layout stable while the reconnect button is loading', () => {
    render(
      <OpenClawConnectionStatePanel
        instance={createInstance({
          connectionState: 'disconnected',
          lastError: 'Gateway 已断开'
        })}
        reconnectPending
        onReconnect={vi.fn()}
        onOpenConfig={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: '腾讯云' })).toBeInTheDocument()
    expect(screen.getByText('已断开')).toBeInTheDocument()
    expect(screen.getByText('当前实例已离线，请重新连接。')).toBeInTheDocument()
    expect(screen.queryByText('连接中')).not.toBeInTheDocument()
    expect(screen.queryByText('正在重新连接')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '实例管理' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新连接' })).toHaveAttribute('aria-busy', 'true')
  })

  it('keeps rendering when historical config misses ssh host/username fields', () => {
    render(
      <OpenClawConnectionStatePanel
        instance={createInstance({
          connectionConfig: {
            title: '历史配置',
            port: 22,
            password: 'secret',
            privateKey: 'PRIVATE_KEY'
          } as unknown as OpenClawInstance['connectionConfig'],
          connectionState: 'disconnected'
        })}
        onReconnect={vi.fn()}
        onOpenConfig={vi.fn()}
      />
    )

    expect(screen.getByText('unknown@unknown-host:22')).toBeInTheDocument()
  })
})
