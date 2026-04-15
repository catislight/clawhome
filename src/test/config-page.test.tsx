import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ConfigPage from '../renderer/src/features/instances/pages/config-page'
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

describe('ConfigPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAppStore.setState(createInitialAppStoreState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the guided setup flow in empty state', () => {
    render(
      <MemoryRouter>
        <ConfigPage />
      </MemoryRouter>
    )

    expect(screen.getByText('实例引导')).toBeInTheDocument()
    expect(screen.getByLabelText('实例名称')).toBeInTheDocument()
    expect(screen.getByLabelText('实例描述（可选）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '继续' })).toBeInTheDocument()
  })

  it('creates and connects the first instance through remote setup', async () => {
    render(
      <MemoryRouter>
        <ConfigPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('实例名称'), { target: { value: '生产集群' } })
    fireEvent.change(screen.getByLabelText('实例描述（可选）'), { target: { value: '线上环境' } })
    fireEvent.click(screen.getByRole('button', { name: /远程连接/ }))
    fireEvent.click(screen.getByRole('button', { name: '继续' }))

    fireEvent.change(screen.getByLabelText('主机地址'), { target: { value: '10.0.0.10' } })
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'root' } })
    fireEvent.change(screen.getByLabelText('登录密码'), { target: { value: 'secret' } })
    fireEvent.change(screen.getByLabelText('私钥'), { target: { value: 'PRIVATE_KEY' } })

    fireEvent.click(screen.getByRole('button', { name: '完成并连接' }))

    await waitFor(() => {
      expect(screen.getByText('生产集群')).toBeInTheDocument()
      expect(screen.queryByText('实例引导')).not.toBeInTheDocument()
    })
  })

  it('auto scans local credentials and connects in local setup mode', async () => {
    window.api.discoverLocalOpenClaw = vi.fn().mockResolvedValue({
      success: true,
      message: '已扫描到本地 OpenClaw token，将自动用于连接。',
      foundCli: true,
      foundToken: true,
      foundPassword: false,
      selectedAuthMode: 'token',
      gatewayToken: 'local-token',
      gatewayPassword: '',
      scannedAt: '2026-04-04T00:00:00.000Z'
    })

    render(
      <MemoryRouter>
        <ConfigPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('实例名称'), { target: { value: '本地开发机' } })
    fireEvent.click(screen.getByRole('button', { name: '继续' }))

    await waitFor(() => {
      expect(window.api.discoverLocalOpenClaw).toHaveBeenCalledWith({ preferMode: 'token' })
      expect(screen.getByText('本地开发机')).toBeInTheDocument()
    })
  })

  it('keeps the wizard on remote connection failure and asks user to check config', async () => {
    window.api.connectGateway = vi.fn().mockResolvedValue({
      success: false,
      message: 'mock gateway connect failed'
    })

    render(
      <MemoryRouter>
        <ConfigPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('实例名称'), { target: { value: '远程失败实例' } })
    fireEvent.click(screen.getByRole('button', { name: /远程连接/ }))
    fireEvent.click(screen.getByRole('button', { name: '继续' }))

    fireEvent.change(screen.getByLabelText('主机地址'), { target: { value: '10.0.0.11' } })
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'root' } })
    fireEvent.change(screen.getByLabelText('登录密码'), { target: { value: 'secret' } })
    fireEvent.change(screen.getByLabelText('私钥'), { target: { value: 'PRIVATE_KEY' } })

    fireEvent.click(screen.getByRole('button', { name: '完成并连接' }))

    await waitFor(() => {
      expect(screen.getByText('连接失败，请检查配置后重试。mock gateway connect failed')).toBeInTheDocument()
    })

    expect(screen.getByText('实例引导')).toBeInTheDocument()
    expect(screen.queryByText('远程失败实例')).not.toBeInTheDocument()
  })

  it('renders cards directly when instances exist', () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-20T08:00:00.000Z',
      lastError: null
    })

    render(
      <MemoryRouter>
        <ConfigPage />
      </MemoryRouter>
    )

    expect(screen.getByText('生产集群')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '实例管理' })).toBeInTheDocument()
    expect(screen.queryByText('实例总数')).not.toBeInTheDocument()
  })

  it('adds another instance through guided setup from the instance-management header', async () => {
    window.api.connectGateway = vi.fn().mockResolvedValue({
      success: true,
      message: 'mock gateway connected'
    })
    window.api.discoverLocalOpenClaw = vi.fn().mockResolvedValue({
      success: true,
      message: '已扫描到本地 OpenClaw token，将自动用于连接。',
      foundCli: true,
      foundToken: true,
      foundPassword: false,
      selectedAuthMode: 'token',
      gatewayToken: 'local-token',
      gatewayPassword: '',
      scannedAt: '2026-04-04T00:00:00.000Z'
    })

    const existingInstanceId = useAppStore.getState().createOpenClawInstance({
      name: '已有实例',
      description: '线上环境'
    })

    useAppStore.getState().saveConnectionConfig(existingInstanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(existingInstanceId, 'connected', {
      lastConnectedAt: '2026-03-20T08:00:00.000Z',
      lastError: null
    })

    render(
      <MemoryRouter>
        <ConfigPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: '新建 OpenClaw' }))

    expect(screen.getByRole('heading', { name: '添加实例' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('实例名称'), { target: { value: '新增实例' } })
    fireEvent.change(screen.getByLabelText('实例描述（可选）'), { target: { value: '本地调试环境' } })
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))

    await waitFor(() => {
      const instanceNames = useAppStore.getState().instances.map((instance) => instance.name)
      expect(instanceNames).toContain('新增实例')
      expect(screen.queryByRole('heading', { name: '添加实例' })).not.toBeInTheDocument()
    })
  })

  it('disables local connection option in add-instance wizard when a local instance already exists', () => {
    const localInstanceId = useAppStore.getState().createOpenClawInstance({
      name: '本地实例',
      description: '本机'
    })

    useAppStore.getState().saveConnectionConfig(localInstanceId, {
      title: '本地实例',
      connectionType: 'local',
      port: 22,
      host: '',
      username: '',
      password: '',
      privateKey: '',
      privateKeyPassphrase: '',
      gatewayHost: '127.0.0.1',
      gatewayPort: 18789,
      gatewayPath: '/',
      gatewayToken: 'token',
      gatewayPassword: ''
    })

    render(
      <MemoryRouter>
        <ConfigPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: '新建 OpenClaw' }))

    const localOption = screen.getByRole('button', { name: /本地连接/ })
    expect(localOption).toBeDisabled()
    expect(screen.getByText('已存在本地实例，本地连接仅允许一个。')).toBeInTheDocument()
  })

  it('shows page header when instances exist but none is connected', () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '未连接实例',
      description: '测试'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'idle', {
      lastConnectedAt: null,
      lastError: null
    })

    render(
      <MemoryRouter>
        <ConfigPage />
      </MemoryRouter>
    )

    expect(screen.getByText('未连接实例')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '实例管理' })).toBeInTheDocument()
  })

  it('does not surface gateway diagnostics in connected card content after a successful connect', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '腾讯云',
      description: '通用场景'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    window.api.connectGateway = vi.fn().mockResolvedValue({
      success: true,
      message: 'mock gateway connected',
      scopes: ['operator.admin'],
      deviceId: 'device-123'
    })

    render(
      <MemoryRouter>
        <ConfigPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: '连接' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '断开连接' })).toBeInTheDocument()
    })

    expect(screen.queryByText(/连接信息：/)).not.toBeInTheDocument()
  })

  it('deletes an instance from the card overflow menu after confirmation', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '待删除实例',
      description: '测试'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <MemoryRouter>
        <ConfigPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '删除实例' }))

    await waitFor(() => {
      expect(screen.queryByText('待删除实例')).not.toBeInTheDocument()
    })
  })

  it('restarts gateway from the card overflow menu after confirmation', async () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '待重启实例',
      description: '测试'
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

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-04-07T07:00:00.000Z',
      lastError: null
    })
    window.api.restartGateway = restartGatewayMock
    window.api.connectGateway = connectGatewayMock

    render(
      <MemoryRouter>
        <ConfigPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '重启 Gateway' }))
    fireEvent.click(screen.getByRole('button', { name: '确认重启' }))

    await waitFor(() => {
      expect(restartGatewayMock).toHaveBeenCalledWith({
        instanceId,
        connection: mockConnectionConfig
      })
      expect(connectGatewayMock).toHaveBeenCalledWith({
        instanceId,
        connection: mockConnectionConfig
      })
      expect(screen.queryByRole('heading', { name: '确认重启 Gateway「待重启实例」' })).not.toBeInTheDocument()
    })
  })
})
