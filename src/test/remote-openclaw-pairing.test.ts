import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SshConnectionConfig } from '../main/node-ssh-util'
import { executeSshCommand } from '../main/node-ssh-util'
import { approveRemoteOpenClawPairing } from '../main/remote-openclaw-pairing'

vi.mock('../main/node-ssh-util', () => ({
  executeSshCommand: vi.fn()
}))

const mockConnectionConfig: SshConnectionConfig = {
  host: '10.0.0.10',
  port: 22,
  username: 'root',
  password: 'secret'
}

describe('approveRemoteOpenClawPairing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects empty request id', async () => {
    const result = await approveRemoteOpenClawPairing(mockConnectionConfig, ' ')

    expect(result.success).toBe(false)
    expect(result.message).toContain('requestId 为空')
    expect(executeSshCommand).not.toHaveBeenCalled()
  })

  it('rejects unsafe request id', async () => {
    const result = await approveRemoteOpenClawPairing(mockConnectionConfig, "req'; rm -rf /")

    expect(result.success).toBe(false)
    expect(result.message).toContain('非法字符')
    expect(executeSshCommand).not.toHaveBeenCalled()
  })

  it('approves pairing on remote server when command succeeds', async () => {
    vi.mocked(executeSshCommand).mockResolvedValue({
      stdout: '{"ok":true}',
      stderr: '',
      code: 0
    })

    const result = await approveRemoteOpenClawPairing(mockConnectionConfig, 'req-123')

    expect(executeSshCommand).toHaveBeenCalledWith(
      mockConnectionConfig,
      'openclaw devices approve req-123 --json'
    )
    expect(result).toEqual({
      success: true,
      message: '远程服务器配对请求已自动批准。'
    })
  })

  it('returns handled message for unknown pending pairing request', async () => {
    vi.mocked(executeSshCommand).mockResolvedValue({
      stdout: '',
      stderr: 'unknown requestId',
      code: 1
    })

    const result = await approveRemoteOpenClawPairing(mockConnectionConfig, 'req-123')

    expect(result.success).toBe(false)
    expect(result.message).toContain('未找到可批准的配对请求')
  })

  it('returns command stderr when remote command fails', async () => {
    vi.mocked(executeSshCommand).mockResolvedValue({
      stdout: '',
      stderr: 'openclaw: command not found',
      code: 127
    })

    const result = await approveRemoteOpenClawPairing(mockConnectionConfig, 'req-123')

    expect(result.success).toBe(false)
    expect(result.message).toContain('openclaw: command not found')
  })

  it('maps privateKeyPassphrase into ssh passphrase when approving remote pairing', async () => {
    vi.mocked(executeSshCommand).mockResolvedValue({
      stdout: '{"ok":true}',
      stderr: '',
      code: 0
    })

    const encryptedKeyConfig = {
      ...mockConnectionConfig,
      privateKey: 'ENCRYPTED_PRIVATE_KEY',
      privateKeyPassphrase: 'my-passphrase'
    }

    const result = await approveRemoteOpenClawPairing(encryptedKeyConfig, 'req-123')

    expect(executeSshCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        privateKey: 'ENCRYPTED_PRIVATE_KEY',
        passphrase: 'my-passphrase'
      }),
      'openclaw devices approve req-123 --json'
    )
    expect(result.success).toBe(true)
  })
})
