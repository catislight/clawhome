import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import OpenClawInstanceCard from '../renderer/src/features/instances/components/openclaw-instance-card'
import type { OpenClawInstance } from '../renderer/src/features/instances/store/use-app-store'

function createInstance(partial: Partial<OpenClawInstance>): OpenClawInstance {
  return {
    id: 'openclaw-test',
    name: '腾讯云',
    description: '通用场景',
    createdAt: '2026-03-20T08:00:00.000Z',
    updatedAt: '2026-03-20T08:00:00.000Z',
    connectionConfig: {
      title: 'root@prod',
      port: 22,
      host: '175.178.126.189',
      username: 'openclaw',
      password: 'secret',
      privateKey: 'PRIVATE_KEY',
      privateKeyPassphrase: ''
    },
    connectionState: 'connected',
    lastConnectedAt: '2026-03-20T08:44:15.000Z',
    lastError: null,
    gatewayRole: 'operator',
    gatewayScopes: ['operator.admin'],
    gatewayDeviceId: 'device-1',
    gatewayServerVersion: null,
    ...partial
  }
}

describe('OpenClawInstanceCard', () => {
  it('keeps low-frequency actions in the overflow menu for connected instances', () => {
    const handleConfigureConnection = vi.fn()
    const handleConnect = vi.fn()
    const handleDisconnect = vi.fn()
    const handleRestart = vi.fn()
    const handleDeleteInstance = vi.fn()

    render(
      <OpenClawInstanceCard
        instance={createInstance({
          lastError: '连接信息：scopes=operator.admin | device=test-device'
        })}
        onConfigureConnection={handleConfigureConnection}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onRestart={handleRestart}
        onDeleteInstance={handleDeleteInstance}
      />
    )

    expect(screen.getByRole('button', { name: '断开连接' })).toBeInTheDocument()
    expect(screen.getByText('已连接')).toBeInTheDocument()
    expect(screen.getByText('创建于 2026/3/20')).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重新连接' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '连接配置' })).not.toBeInTheDocument()
    expect(screen.queryByText(/上次成功/)).not.toBeInTheDocument()
    expect(screen.queryByText(/连接信息：/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))

    const menu = screen.getByRole('menu')

    expect(menu).toHaveClass('min-w-[9rem]', 'bg-white', 'p-1.5', 'duration-150')
    expect(within(menu).getByRole('menuitem', { name: '连接配置' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: '重新连接' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: '重启 Gateway' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: '删除实例' })).toBeInTheDocument()

    fireEvent.click(within(menu).getByRole('menuitem', { name: '连接配置' }))

    expect(handleConfigureConnection).toHaveBeenCalledTimes(1)
    expect(handleConnect).toHaveBeenCalledTimes(0)
    expect(handleDisconnect).toHaveBeenCalledTimes(0)
    expect(handleDeleteInstance).toHaveBeenCalledTimes(0)

    fireEvent.click(screen.getByRole('button', { name: '断开连接' }))

    expect(handleDisconnect).toHaveBeenCalledTimes(1)
    expect(handleRestart).toHaveBeenCalledTimes(0)
  })

  it('keeps connect as the primary action before the instance is connected', () => {
    const handleDeleteInstance = vi.fn()

    render(
      <OpenClawInstanceCard
        instance={createInstance({
          connectionConfig: null,
          connectionState: 'idle',
          lastConnectedAt: null
        })}
        onConfigureConnection={vi.fn()}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        onRestart={vi.fn()}
        onDeleteInstance={handleDeleteInstance}
      />
    )

    expect(screen.getByRole('button', { name: '连接' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '断开连接' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))

    const menu = screen.getByRole('menu')

    expect(within(menu).getByRole('menuitem', { name: '连接配置' })).toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: '重新连接' })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: '重启 Gateway' })).not.toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: '删除实例' })).toBeInTheDocument()
    expect(handleDeleteInstance).toHaveBeenCalledTimes(0)
  })

  it('triggers delete action from overflow menu', () => {
    const handleDeleteInstance = vi.fn()

    render(
      <OpenClawInstanceCard
        instance={createInstance({
          connectionState: 'idle'
        })}
        onConfigureConnection={vi.fn()}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        onRestart={vi.fn()}
        onDeleteInstance={handleDeleteInstance}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '删除实例' }))

    expect(handleDeleteInstance).toHaveBeenCalledTimes(1)
    expect(handleDeleteInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'openclaw-test'
      })
    )
  })

  it('shows the inline status message only for failed connections', () => {
    render(
      <OpenClawInstanceCard
        instance={createInstance({
          connectionState: 'error',
          lastError: '权限不足，请重新授权后重试。'
        })}
        onConfigureConnection={vi.fn()}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        onRestart={vi.fn()}
        onDeleteInstance={vi.fn()}
      />
    )

    expect(screen.getByText('权限不足，请重新授权后重试。')).toBeInTheDocument()
  })

  it('falls back to the connected server version when runtime snapshot has no version', () => {
    render(
      <OpenClawInstanceCard
        instance={createInstance({
          gatewayServerVersion: '2026.4.3'
        })}
        onConfigureConnection={vi.fn()}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        onRestart={vi.fn()}
        onDeleteInstance={vi.fn()}
      />
    )

    expect(screen.getByText('2026.4.3')).toBeInTheDocument()
  })

  it('triggers restart action from overflow menu', () => {
    const handleRestart = vi.fn()

    render(
      <OpenClawInstanceCard
        instance={createInstance({
          connectionState: 'connected'
        })}
        onConfigureConnection={vi.fn()}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        onRestart={handleRestart}
        onDeleteInstance={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '重启 Gateway' }))

    expect(handleRestart).toHaveBeenCalledTimes(1)
    expect(handleRestart).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'openclaw-test'
      })
    )
  })
})
