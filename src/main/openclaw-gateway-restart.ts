import { runLocalOpenClawCli } from './local-openclaw-cli'
import { executeSshCommand, type SshConnectionConfig } from './node-ssh-util'
import type { GatewayConnectionConfig } from './openclaw-gateway-session'

const OPENCLAW_GATEWAY_RESTART_COMMAND = 'openclaw gateway restart'

export type GatewayRestartExecutionResult = {
  success: boolean
  message: string
  stdout: string
  stderr: string
  code: number | null
}

function toSshConnectionConfig(connection: GatewayConnectionConfig): SshConnectionConfig {
  return {
    host: connection.host,
    port: connection.port,
    username: connection.username,
    password: connection.password,
    privateKey: connection.privateKey,
    passphrase: connection.privateKeyPassphrase
  }
}

function resolveFailureMessage(stderr: string, stdout: string, fallback: string): string {
  const normalizedStderr = stderr.trim()
  if (normalizedStderr) {
    return normalizedStderr
  }

  const normalizedStdout = stdout.trim()
  if (normalizedStdout) {
    return normalizedStdout
  }

  return fallback
}

export async function restartOpenClawGateway(
  connection: GatewayConnectionConfig
): Promise<GatewayRestartExecutionResult> {
  if (connection.connectionType === 'local') {
    try {
      const result = await runLocalOpenClawCli(['gateway', 'restart'])

      return {
        success: true,
        message: 'Gateway 重启指令已执行。',
        stdout: result.stdout,
        stderr: result.stderr,
        code: 0
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行本地 gateway 重启命令失败。'

      return {
        success: false,
        message: `Gateway 重启失败：${message}`,
        stdout: '',
        stderr: message,
        code: null
      }
    }
  }

  try {
    const result = await executeSshCommand(
      toSshConnectionConfig(connection),
      OPENCLAW_GATEWAY_RESTART_COMMAND
    )
    const success = result.code === 0

    return {
      success,
      message: success
        ? 'Gateway 重启指令已执行。'
        : `Gateway 重启失败：${resolveFailureMessage(result.stderr, result.stdout, `命令退出码 ${result.code ?? 'unknown'}`)}`,
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '执行远程 gateway 重启命令失败。'

    return {
      success: false,
      message: `Gateway 重启失败：${message}`,
      stdout: '',
      stderr: message,
      code: null
    }
  }
}
