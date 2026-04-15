import type { OpenClawConnectionState } from '@/features/instances/store/use-app-store'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

export const OPENCLAW_CONNECTION_POLL_INTERVAL_MS = 3_000
export const OPENCLAW_UNEXPECTED_DISCONNECT_MESSAGE = translateWithAppLanguage(
  'instances.connectionState.unexpectedDisconnect'
)

export function getOpenClawUnexpectedDisconnectMessage(): string {
  return translateWithAppLanguage('instances.connectionState.unexpectedDisconnect')
}

export function getOpenClawConnectionStateLabel(connectionState: OpenClawConnectionState): string {
  switch (connectionState) {
    case 'connected':
      return translateWithAppLanguage('instances.connectionPanel.status.connected')
    case 'connecting':
      return translateWithAppLanguage('instances.connectionState.label.connecting')
    case 'disconnected':
      return translateWithAppLanguage('instances.connectionPanel.status.disconnected')
    case 'error':
      return translateWithAppLanguage('instances.connectionPanel.status.failed')
    default:
      return translateWithAppLanguage('instances.connectionPanel.status.pending')
  }
}

export function getOpenClawConnectionStateClassName(
  connectionState: OpenClawConnectionState
): string {
  switch (connectionState) {
    case 'connected':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'connecting':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'disconnected':
      return 'border-orange-200 bg-orange-50 text-orange-700'
    case 'error':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    default:
      return 'border-sky-200 bg-sky-50 text-sky-700'
  }
}
