import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import OpenClawConnectionDialog from '../renderer/src/features/instances/components/openclaw-connection-dialog'
import type { OpenClawInstance } from '../renderer/src/features/instances/store/use-app-store'

function createInstance(partial: Partial<OpenClawInstance> = {}): OpenClawInstance {
  return {
    id: 'openclaw-instance',
    name: '腾讯云',
    description: '',
    createdAt: '2026-03-20T08:00:00.000Z',
    updatedAt: '2026-03-20T09:30:00.000Z',
    connectionConfig: {
      title: '腾讯云',
      port: 22,
      host: '175.178.126.189',
      username: 'openclaw',
      password: 'secret',
      privateKey: 'PRIVATE_KEY',
      privateKeyPassphrase: ''
    },
    connectionState: 'connected',
    lastConnectedAt: '2026-03-20T09:00:00.000Z',
    lastError: null,
    ...partial
  }
}

describe('OpenClawConnectionDialog', () => {
  it('keeps the connection dialog focused on fields instead of repeated summaries', () => {
    render(
      <OpenClawConnectionDialog
        instance={createInstance()}
        open
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '连接配置 · 腾讯云' })).toBeInTheDocument()
    expect(screen.getByLabelText('连接名称')).toBeInTheDocument()
    expect(screen.getByLabelText('SSH 端口')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveClass('max-w-none')
    expect(screen.getByRole('dialog')).toHaveStyle({
      width: 'min(32rem, calc(100vw - 1rem))'
    })
    expect(screen.getByTestId('ssh-title-row')).toHaveClass('grid', 'sm:grid-cols-2')
    expect(screen.getByTestId('ssh-access-row')).toHaveClass('grid', 'sm:grid-cols-2')
    expect(screen.getByTestId('gateway-secret-row')).toHaveClass('grid', 'sm:grid-cols-2')
    expect(
      screen.queryByText(
        '保存后会持久化到本地，后续可以直接在卡片上点击“连接”复用这套 SSH 连接方式。'
      )
    ).not.toBeInTheDocument()
    expect(screen.queryByText('当前实例')).not.toBeInTheDocument()
    expect(screen.queryByText('用于卡片辨认')).not.toBeInTheDocument()
    expect(screen.queryByText('默认 22')).not.toBeInTheDocument()
    expect(screen.queryByText('完整粘贴 OpenSSH 内容')).not.toBeInTheDocument()
    expect(
      screen.queryByText('只在需要自定义 Gateway Origin、Token 或 Password 时填写。')
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '展开高级项' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Gateway Origin')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Gateway 令牌')).toBeInTheDocument()
    expect(screen.getByLabelText('Gateway 密码')).toBeInTheDocument()
    expect(screen.getByLabelText('私钥密码')).toBeInTheDocument()
    expect(screen.getByLabelText('私钥')).toHaveClass('min-h-[10rem]', 'resize-none')
    expect(
      screen.getByText('Gateway 密码').compareDocumentPosition(screen.getByText('私钥'))
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(
      screen.getByText('私钥').compareDocumentPosition(screen.getByText('私钥密码'))
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(screen.getByTestId('dialog-footer')).toHaveClass('mt-2', 'pt-4', 'pb-1', 'gap-4')
  })
})
