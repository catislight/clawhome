import { Loader2 } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { formatOpenClawConnectionSummary } from '@/features/instances/lib/openclaw-connection-config'
import { getOpenClawConnectionStateClassName } from '@/features/instances/lib/openclaw-connection-state'
import type { OpenClawInstance } from '@/features/instances/store/use-app-store'
import { useAppI18n } from '@/shared/i18n/app-i18n'

type PanelCopy = {
  description: string
  primaryActionLabel: string | null
  statusLabel: string
}

type OpenClawConnectionStatePanelProps = {
  instance: OpenClawInstance
  reconnectPending?: boolean
  onReconnect: (instance: OpenClawInstance) => void
  onOpenConfig: () => void
  descriptionOverride?: string
}

function getPanelCopy(
  instance: OpenClawInstance,
  t: ReturnType<typeof useAppI18n>['t'],
  descriptionOverride?: string
): PanelCopy {
  if (!instance.connectionConfig) {
    return {
      description: descriptionOverride ?? t('instances.connectionPanel.description.needConfig'),
      primaryActionLabel: null,
      statusLabel: t('instances.connectionPanel.status.notConfigured')
    }
  }

  switch (instance.connectionState) {
    case 'connecting':
      return {
        description: descriptionOverride ?? t('instances.connectionPanel.description.connecting'),
        primaryActionLabel: instance.lastConnectedAt
          ? t('instances.connectionPanel.action.reconnect')
          : t('instances.connectionPanel.action.connect'),
        statusLabel: instance.lastConnectedAt
          ? t('instances.connectionPanel.status.disconnected')
          : t('instances.connectionPanel.status.pending')
      }
    case 'disconnected':
      return {
        description: descriptionOverride ?? t('instances.connectionPanel.description.offline'),
        primaryActionLabel: t('instances.connectionPanel.action.reconnect'),
        statusLabel: t('instances.connectionPanel.status.disconnected')
      }
    case 'error':
      return {
        description: descriptionOverride ?? t('instances.connectionPanel.description.retry'),
        primaryActionLabel: t('instances.connectionPanel.action.reconnect'),
        statusLabel: t('instances.connectionPanel.status.failed')
      }
    case 'connected':
      return {
        description: descriptionOverride ?? t('instances.connectionPanel.description.ready'),
        primaryActionLabel: t('instances.connectionPanel.action.connect'),
        statusLabel: t('instances.connectionPanel.status.connected')
      }
    default:
      return {
        description: descriptionOverride ?? t('instances.connectionPanel.description.ready'),
        primaryActionLabel: t('instances.connectionPanel.action.connect'),
        statusLabel: t('instances.connectionPanel.status.pending')
      }
  }
}

function OpenClawConnectionStatePanel({
  instance,
  reconnectPending = false,
  onReconnect,
  onOpenConfig,
  descriptionOverride
}: OpenClawConnectionStatePanelProps): React.JSX.Element {
  const { t } = useAppI18n()
  const panelCopy = getPanelCopy(instance, t, descriptionOverride)
  const connectionSummary = instance.connectionConfig
    ? formatOpenClawConnectionSummary(
        instance.connectionConfig,
        t('instances.connectionSummary.localGateway')
      )
    : t('instances.connectionPanel.summary.notSaved')
  const statusClassName = getOpenClawConnectionStateClassName(
    instance.connectionState === 'connecting' && instance.lastConnectedAt
      ? 'disconnected'
      : instance.connectionState
  )
  const showNotice = instance.connectionState === 'error' && Boolean(instance.lastError)

  return (
    <section className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
      <div className="mx-auto w-full max-w-[40rem] rounded-[0.95rem] border border-black/6 bg-card p-6 shadow-[0_20px_48px_-42px_rgba(15,23,42,0.22)] md:w-[min(50vw,40rem)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-[1.35rem] font-semibold tracking-tight text-foreground">
              {instance.name}
            </h2>
          </div>

          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-[0.75rem] border px-2.5 py-1 text-xs font-medium ${statusClassName}`}
          >
            {panelCopy.statusLabel}
          </span>
        </div>

        <p className="mt-3 max-w-[32rem] text-sm leading-6 text-muted-foreground">
          {panelCopy.description}
        </p>

        {showNotice ? (
          <p className="mt-4 rounded-[0.8rem] border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm leading-6 text-rose-700">
            {instance.lastError}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="inline-flex max-w-full rounded-[0.75rem] border border-black/8 bg-background px-3 py-2 font-mono text-[12px] leading-5 text-foreground">
              <span className="truncate">{connectionSummary}</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-[0.8rem] px-4"
              onClick={onOpenConfig}
            >
              {t('instances.connectionPanel.action.manage')}
            </Button>

            {panelCopy.primaryActionLabel ? (
              <Button
                type="button"
                className="relative h-10 rounded-[0.8rem] px-4"
                disabled={reconnectPending}
                aria-busy={reconnectPending}
                onClick={() => onReconnect(instance)}
              >
                {reconnectPending ? (
                  <Loader2 className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 animate-spin" />
                ) : null}
                <span className={reconnectPending ? 'pl-5' : ''}>
                  {panelCopy.primaryActionLabel}
                </span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

export default OpenClawConnectionStatePanel
