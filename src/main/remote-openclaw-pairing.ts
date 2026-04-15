import { executeSshCommand, type SshConnectionConfig } from './node-ssh-util'

type PairingApprovalResult = {
  success: boolean
  message: string
}

type RemotePairingConnectionConfig = SshConnectionConfig & {
  privateKeyPassphrase?: string
}

function normalizeCliMessage(rawMessage: string): string {
  return rawMessage.trim().toLowerCase()
}

function isSafePairingRequestId(requestId: string): boolean {
  return /^[A-Za-z0-9._:-]+$/.test(requestId)
}

function resolveCommandFailureMessage(code: number | null, stdout: string, stderr: string): string {
  const stderrTrimmed = stderr.trim()
  const stdoutTrimmed = stdout.trim()
  const reason = stderrTrimmed || stdoutTrimmed || `命令退出码 ${code ?? 'unknown'}`
  return `远程自动配对失败：${reason}`
}

function normalizeSshConfigForPairing(
  connectionConfig: RemotePairingConnectionConfig
): SshConnectionConfig {
  const preferredPassphrase =
    typeof connectionConfig.passphrase === 'string' && connectionConfig.passphrase.trim().length > 0
      ? connectionConfig.passphrase
      : typeof connectionConfig.privateKeyPassphrase === 'string' &&
          connectionConfig.privateKeyPassphrase.trim().length > 0
        ? connectionConfig.privateKeyPassphrase
        : undefined

  return {
    ...connectionConfig,
    passphrase: preferredPassphrase
  }
}

export async function approveRemoteOpenClawPairing(
  connectionConfig: RemotePairingConnectionConfig,
  requestId: string
): Promise<PairingApprovalResult> {
  const normalizedRequestId = requestId.trim()
  if (!normalizedRequestId) {
    return {
      success: false,
      message: 'pairing requestId 为空，无法自动配对。'
    }
  }

  if (!isSafePairingRequestId(normalizedRequestId)) {
    return {
      success: false,
      message: 'pairing requestId 含非法字符，已跳过自动配对。'
    }
  }

  try {
    const normalizedConnectionConfig = normalizeSshConfigForPairing(connectionConfig)
    const result = await executeSshCommand(
      normalizedConnectionConfig,
      `openclaw devices approve ${normalizedRequestId} --json`
    )

    const normalizedMessage = normalizeCliMessage(`${result.stderr}\n${result.stdout}`)
    if (result.code !== 0) {
      if (
        normalizedMessage.includes('unknown requestid') ||
        normalizedMessage.includes('no pending device pairing requests')
      ) {
        return {
          success: false,
          message: '远程服务器未找到可批准的配对请求，可能已被处理。'
        }
      }

      return {
        success: false,
        message: resolveCommandFailureMessage(result.code, result.stdout, result.stderr)
      }
    }

    return {
      success: true,
      message: '远程服务器配对请求已自动批准。'
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      message: `远程自动配对失败：${message}`
    }
  }
}
