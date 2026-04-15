import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

export const DEFAULT_LOCAL_GATEWAY_HOST = '127.0.0.1'
export const DEFAULT_LOCAL_GATEWAY_PORT = 18789
export const DEFAULT_LOCAL_GATEWAY_PATH = '/'

export type OpenClawConnectionType = 'ssh' | 'local'

function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function resolveOpenClawConnectionType(
  connectionConfig: SshConnectionFormValues | null | undefined
): OpenClawConnectionType {
  return connectionConfig?.connectionType === 'local' ? 'local' : 'ssh'
}

export function isLocalOpenClawConnection(
  connectionConfig: SshConnectionFormValues | null | undefined
): boolean {
  return resolveOpenClawConnectionType(connectionConfig) === 'local'
}

export function normalizeGatewayPath(rawPath: string | undefined): string {
  const trimmed = readTrimmedString(rawPath)
  if (!trimmed || trimmed === '/') {
    return DEFAULT_LOCAL_GATEWAY_PATH
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export function resolveGatewayHost(connectionConfig: SshConnectionFormValues): string {
  const host = readTrimmedString(connectionConfig.gatewayHost)
  return host || DEFAULT_LOCAL_GATEWAY_HOST
}

export function resolveGatewayPort(connectionConfig: SshConnectionFormValues): number {
  const port = connectionConfig.gatewayPort
  if (typeof port !== 'number' || !Number.isFinite(port)) {
    return DEFAULT_LOCAL_GATEWAY_PORT
  }

  const normalized = Math.floor(port)
  if (normalized < 1 || normalized > 65535) {
    return DEFAULT_LOCAL_GATEWAY_PORT
  }

  return normalized
}

export function resolveGatewayPath(connectionConfig: SshConnectionFormValues): string {
  return normalizeGatewayPath(connectionConfig.gatewayPath)
}

export function formatOpenClawConnectionSummary(
  connectionConfig: SshConnectionFormValues,
  localGatewayLabel = translateWithAppLanguage('instances.connectionSummary.localGateway')
): string {
  if (isLocalOpenClawConnection(connectionConfig)) {
    const host = resolveGatewayHost(connectionConfig)
    const port = resolveGatewayPort(connectionConfig)
    const gatewayPath = resolveGatewayPath(connectionConfig)
    return gatewayPath === '/'
      ? `${localGatewayLabel} ${host}:${port}`
      : `${localGatewayLabel} ${host}:${port}${gatewayPath}`
  }

  const username =
    readTrimmedString(connectionConfig.username) ||
    translateWithAppLanguage('instances.connectionSummary.unknownUser')
  const host =
    readTrimmedString(connectionConfig.host) ||
    translateWithAppLanguage('instances.connectionSummary.unknownHost')
  const port =
    typeof connectionConfig.port === 'number' && Number.isFinite(connectionConfig.port)
      ? connectionConfig.port
      : 22

  return `${username}@${host}:${port}`
}
