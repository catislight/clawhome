import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '../renderer/src/App'
import {
  createInitialAppStoreState,
  useAppStore
} from '../renderer/src/features/instances/store/use-app-store'

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAppStore.setState(createInitialAppStoreState())
  })

  it('renders sidebar navigation on home route', () => {
    window.history.pushState({}, '', '/')

    render(<App />)

    expect(screen.getByText('ClawHome')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '打开偏好设置' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '对话中心' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '定时任务' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '素材库' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '日志中心' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '便捷终端' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '技能中心' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '智能体中心' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '全局配置' })).toBeInTheDocument()
    expect(screen.getByText('当前实例')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('navigates to preferences page from sidebar header icon', () => {
    window.history.pushState({}, '', '/')

    render(<App />)

    fireEvent.click(screen.getByRole('link', { name: '打开偏好设置' }))

    expect(window.location.pathname).toBe('/preferences')
    expect(screen.getByRole('heading', { name: '常规' })).toBeInTheDocument()
  })

  it('redirects unknown route to home', () => {
    window.history.pushState({}, '', '/not-found')

    render(<App />)

    expect(screen.getByRole('link', { name: '对话中心' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('navigates to config page from the sidebar', () => {
    useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })
    window.history.pushState({}, '', '/')

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '打开实例管理' }))

    expect(window.location.pathname).toBe('/config')
    expect(screen.getAllByText('生产集群').length).toBeGreaterThan(0)
  })

  it('navigates to cron page from the sidebar', () => {
    window.history.pushState({}, '', '/')

    render(<App />)

    fireEvent.click(screen.getByRole('link', { name: '定时任务' }))

    expect(window.location.pathname).toBe('/cron')
    expect(screen.getByText('暂无实例，')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '去创建' })).toBeInTheDocument()
  })

  it('navigates to knowledge base page from the sidebar', () => {
    window.history.pushState({}, '', '/')

    render(<App />)

    fireEvent.click(screen.getByRole('link', { name: '素材库' }))

    expect(window.location.pathname).toBe('/knowledge-base')
    expect(screen.getByText('暂无收藏内容')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '提示词' }))
    expect(screen.getByText('暂无提示词模板')).toBeInTheDocument()
  })

  it('navigates to logs page from the sidebar', () => {
    window.history.pushState({}, '', '/')

    render(<App />)

    fireEvent.click(screen.getByRole('link', { name: '日志中心' }))

    expect(window.location.pathname).toBe('/logs')
    expect(screen.getByText('暂无实例，')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '去创建' })).toBeInTheDocument()
  })

  it('switches the active workspace instance from the footer popover', () => {
    const connectedInstanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })
    const standbyInstanceId = useAppStore.getState().createOpenClawInstance({
      name: '灰度环境',
      description: '灰度发布'
    })

    useAppStore.getState().setConnectionState(connectedInstanceId, 'connected', {
      lastConnectedAt: '2026-03-25T08:00:00.000Z',
      lastError: null
    })

    window.history.pushState({}, '', '/')

    render(<App />)

    expect(screen.getByRole('button', { name: '切换当前实例' })).toHaveTextContent('生产集群')

    fireEvent.click(screen.getByRole('button', { name: '切换当前实例' }))
    fireEvent.click(screen.getByRole('option', { name: '灰度环境' }))

    expect(useAppStore.getState().workspaceInstanceId).toBe(standbyInstanceId)
    expect(screen.getByRole('button', { name: '切换当前实例' })).toHaveTextContent('灰度环境')
  })

  it('restarts gateway from the current-instance footer overflow after confirmation', async () => {
    const connectedInstanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })
    const restartGatewayMock = vi.fn().mockResolvedValue({
      success: true,
      message: 'mock gateway restarted',
      stdout: '',
      stderr: '',
      code: 0
    })
    const connectGatewayMock = vi.fn().mockResolvedValue({
      success: true,
      message: 'mock reconnected'
    })

    useAppStore.getState().saveConnectionConfig(connectedInstanceId, {
      title: 'root@prod',
      port: 22,
      host: '10.0.0.10',
      username: 'root',
      password: 'secret',
      privateKey: 'PRIVATE_KEY',
      privateKeyPassphrase: ''
    })
    useAppStore.getState().setConnectionState(connectedInstanceId, 'connected', {
      lastConnectedAt: '2026-03-25T08:00:00.000Z',
      lastError: null
    })
    window.api.restartGateway = restartGatewayMock
    window.api.connectGateway = connectGatewayMock
    window.history.pushState({}, '', '/')

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '当前实例操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '重启 Gateway' }))
    fireEvent.click(screen.getByRole('button', { name: '确认重启' }))

    await waitFor(() => {
      expect(restartGatewayMock).toHaveBeenCalledWith({
        instanceId: connectedInstanceId,
        connection: {
          title: 'root@prod',
          port: 22,
          host: '10.0.0.10',
          username: 'root',
          password: 'secret',
          privateKey: 'PRIVATE_KEY',
          privateKeyPassphrase: ''
        }
      })
      expect(connectGatewayMock).toHaveBeenCalledWith({
        instanceId: connectedInstanceId,
        connection: {
          title: 'root@prod',
          port: 22,
          host: '10.0.0.10',
          username: 'root',
          password: 'secret',
          privateKey: 'PRIVATE_KEY',
          privateKeyPassphrase: ''
        }
      })
    })
  })
})
