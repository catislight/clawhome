import { Server } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  isLocalOpenClawConnection,
  normalizeGatewayPath,
  resolveGatewayHost,
  resolveGatewayPort
} from '@/features/instances/lib/openclaw-connection-config'
import { readOpenClawInstanceRuntimeSnapshot } from '@/features/instances/lib/openclaw-instance-runtime'
import {
  getOpenClawConnectionStateClassName,
  getOpenClawConnectionStateLabel
} from '@/features/instances/lib/openclaw-connection-state'
import type { OpenClawInstance } from '@/features/instances/store/use-app-store'
import { Button } from '@/shared/ui/button'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { OverflowMenu } from '@/shared/ui/overflow-menu'

const GATEWAY_CLIENT_ID = 'gateway-client'

type OpenClawInstanceCardProps = {
  instance: OpenClawInstance
  onConnect: (instance: OpenClawInstance) => void
  onDisconnect: (instance: OpenClawInstance) => void
  onRestart: (instance: OpenClawInstance) => void
  onConfigureConnection: (instance: OpenClawInstance) => void
  onDeleteInstance: (instance: OpenClawInstance) => void
}

function formatCardDateTime(
  value: string | null | undefined,
  locale: string,
  fallback: string
): string {
  if (!value) {
    return fallback
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return fallback
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(parsed)
}

function formatCardDate(value: string | null | undefined, locale: string, fallback: string): string {
  if (!value) {
    return fallback
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return fallback
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).format(parsed)
}

function formatUptimeLabel(
  totalSeconds: number | null,
  t: ReturnType<typeof useAppI18n>['t']
): string {
  if (typeof totalSeconds !== 'number' || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return t('instances.instanceCard.fallbackValue')
  }

  const seconds = Math.floor(totalSeconds)
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const remainSeconds = seconds % 60
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(remainSeconds).padStart(2, '0')

  if (days > 0) {
    return t('instances.instanceCard.uptime.days', {
      days,
      time: `${hh}:${mm}:${ss}`
    })
  }

  return `${hh}:${mm}:${ss}`
}

function getStatusLabel(
  instance: OpenClawInstance,
  t: ReturnType<typeof useAppI18n>['t']
): string {
  if (!instance.connectionConfig) {
    return t('instances.instanceCard.status.needConfig')
  }

  return getOpenClawConnectionStateLabel(instance.connectionState)
}

function getStatusClassName(instance: OpenClawInstance): string {
  if (!instance.connectionConfig) {
    return 'border-black/8 bg-secondary text-secondary-foreground'
  }

  return getOpenClawConnectionStateClassName(instance.connectionState)
}

function resolveConnectionMethodLabel(
  instance: OpenClawInstance,
  t: ReturnType<typeof useAppI18n>['t']
): string {
  if (!instance.connectionConfig) {
    return t('instances.instanceCard.fallbackValue')
  }

  if (isLocalOpenClawConnection(instance.connectionConfig)) {
    return t('instances.instanceCard.connectionMethod.localLan')
  }

  const host = instance.connectionConfig.host.trim().toLowerCase()
  if (!host) {
    return t('instances.instanceCard.connectionMethod.remoteUrl')
  }

  const isTailScaleDomain = host.endsWith('.ts.net') || host.includes('tailscale')
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  const isTailScaleIp =
    ipv4Match !== null &&
    Number(ipv4Match[1]) === 100 &&
    Number(ipv4Match[2]) >= 64 &&
    Number(ipv4Match[2]) <= 127

  if (isTailScaleDomain || isTailScaleIp) {
    return 'Tailscale'
  }

  return t('instances.instanceCard.connectionMethod.remoteUrl')
}

function resolveGatewayAddress(
  instance: OpenClawInstance,
  t: ReturnType<typeof useAppI18n>['t']
): string {
  if (!instance.connectionConfig) {
    return t('instances.instanceCard.fallbackValue')
  }

  const host = resolveGatewayHost(instance.connectionConfig)
  const port = resolveGatewayPort(instance.connectionConfig)
  const path = normalizeGatewayPath(instance.connectionConfig.gatewayPath)
  return path === '/' ? `${host}:${port}` : `${host}:${port}${path}`
}

function InfoItem({ label, value, title }: { label: string; value: string; title?: string }): React.JSX.Element {
  return (
    <div className="min-w-0 py-0.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-foreground" title={title ?? value}>
        {value}
      </p>
    </div>
  )
}

function OpenClawInstanceCard({
  instance,
  onConnect,
  onDisconnect,
  onRestart,
  onConfigureConnection,
  onDeleteInstance
}: OpenClawInstanceCardProps): React.JSX.Element {
  const { t, language } = useAppI18n()
  const [nowMs, setNowMs] = useState<number>(() => Date.now())
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<Awaited<
    ReturnType<typeof readOpenClawInstanceRuntimeSnapshot>
  >>(null)

  useEffect(() => {
    let active = true

    if (instance.connectionState !== 'connected') {
      setRuntimeSnapshot(null)
      return () => {
        active = false
      }
    }

    const readRuntime = async (): Promise<void> => {
      const snapshot = await readOpenClawInstanceRuntimeSnapshot(instance.id).catch(() => null)
      if (!active) {
        return
      }
      setRuntimeSnapshot(snapshot)
    }

    void readRuntime()
    const pollTimer = window.setInterval(() => {
      void readRuntime()
    }, 15_000)

    return () => {
      active = false
      window.clearInterval(pollTimer)
    }
  }, [instance.connectionState, instance.id])

  useEffect(() => {
    setNowMs(Date.now())
    if (instance.connectionState !== 'connected') {
      return undefined
    }

    const uptimeTicker = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1_000)

    return () => {
      window.clearInterval(uptimeTicker)
    }
  }, [instance.connectionState, instance.id])

  const canDisconnect = instance.connectionState === 'connected'
  const errorLabel = instance.connectionState === 'error' ? instance.lastError : null
  const primaryActionLabel = canDisconnect
    ? t('instances.instanceCard.primaryAction.disconnect')
    : instance.connectionState === 'connecting'
      ? t('instances.instanceCard.primaryAction.connecting')
      : t('instances.instanceCard.primaryAction.connect')

  const statusLabel = getStatusLabel(instance, t)
  const statusClassName = getStatusClassName(instance)
  const connectionMethodLabel = resolveConnectionMethodLabel(instance, t)
  const gatewayAddress = resolveGatewayAddress(instance, t)
  const resolvedDeviceId =
    instance.gatewayDeviceId ?? runtimeSnapshot?.deviceId ?? t('instances.instanceCard.fallbackValue')
  const clientIdLabel = GATEWAY_CLIENT_ID
  const lastActiveLabel = formatCardDateTime(
    runtimeSnapshot?.lastActiveAt ?? instance.updatedAt,
    language,
    t('instances.instanceCard.fallbackValue')
  )

  const fallbackUptimeSeconds = (() => {
    if (!canDisconnect || !instance.lastConnectedAt) {
      return null
    }

    const connectedAtMs = new Date(instance.lastConnectedAt).getTime()
    if (Number.isNaN(connectedAtMs)) {
      return null
    }

    return Math.max(0, Math.floor((nowMs - connectedAtMs) / 1_000))
  })()

  const serverUptimeSeconds =
    typeof runtimeSnapshot?.uptimeSeconds === 'number' &&
    typeof runtimeSnapshot.fetchedAtMs === 'number'
      ? runtimeSnapshot.uptimeSeconds + Math.max(0, Math.floor((nowMs - runtimeSnapshot.fetchedAtMs) / 1_000))
      : null

  const uptimeLabel = formatUptimeLabel(serverUptimeSeconds ?? fallbackUptimeSeconds, t)
  const versionLabel =
    runtimeSnapshot?.openclawVersion ??
    instance.gatewayServerVersion ??
    t('instances.instanceCard.fallbackValue')
  const platformLabel =
    runtimeSnapshot?.platform ??
    (instance.connectionConfig && isLocalOpenClawConnection(instance.connectionConfig)
      ? window.navigator.platform || t('instances.instanceCard.fallbackValue')
      : t('instances.instanceCard.fallbackValue'))

  return (
    <article className="group flex h-full flex-col rounded-[0.85rem] border border-black/6 bg-card p-4 shadow-[0_18px_36px_-34px_rgba(15,23,42,0.18)] transition-all duration-200">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-[0.75rem] bg-primary/10 text-primary">
            <Server className="size-4" />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
              {instance.name}
            </h2>
            <span
              className={`inline-flex shrink-0 rounded-[0.7rem] border px-2 py-0.5 text-xs font-medium ${statusClassName}`}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        <OverflowMenu
          items={[
            {
              key: 'configure-connection',
              label: t('instances.instanceCard.menu.configureConnection'),
              onSelect: () => onConfigureConnection(instance)
            },
            {
              key: 'reconnect',
              label: t('instances.instanceCard.menu.reconnect'),
              onSelect: () => onConnect(instance),
              hidden: !canDisconnect
            },
            {
              key: 'restart-gateway',
              label: t('instances.instanceCard.menu.restartGateway'),
              onSelect: () => onRestart(instance),
              hidden: !canDisconnect
            },
            {
              key: 'disconnect',
              label: t('instances.instanceCard.menu.disconnect'),
              onSelect: () => onDisconnect(instance),
              hidden: !canDisconnect
            },
            {
              key: 'delete-instance',
              label: t('instances.instanceCard.menu.deleteInstance'),
              onSelect: () => onDeleteInstance(instance)
            }
          ]}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-black/6 pt-3">
        <InfoItem label={t('instances.instanceCard.info.connectionMethod')} value={connectionMethodLabel} />
        <InfoItem label={t('instances.instanceCard.info.gatewayAddress')} value={gatewayAddress} />
        <InfoItem label={t('instances.instanceCard.info.deviceId')} value={resolvedDeviceId} />
        <InfoItem label={t('instances.instanceCard.info.clientId')} value={clientIdLabel} />
        <InfoItem label={t('instances.instanceCard.info.uptime')} value={uptimeLabel} />
        <InfoItem label={t('instances.instanceCard.info.lastActive')} value={lastActiveLabel} />
        <InfoItem label={t('instances.instanceCard.info.version')} value={versionLabel} />
        <InfoItem label={t('instances.instanceCard.info.platform')} value={platformLabel} />
      </div>

      {errorLabel ? (
        <p className="mt-2 truncate text-xs text-rose-600" title={errorLabel}>
          {errorLabel}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/6 pt-3">
        <span className="text-[11px] text-muted-foreground">
          {t('instances.instanceCard.createdAt', {
            date: formatCardDate(instance.createdAt, language, t('instances.instanceCard.fallbackValue'))
          })}
        </span>
        <Button
          type="button"
          variant="ghost"
          className={
            canDisconnect
              ? 'h-8 rounded-[0.75rem] px-2.5 text-rose-700 hover:bg-rose-50 hover:text-rose-800'
              : 'h-8 rounded-[0.75rem] px-2.5 text-primary hover:bg-primary/8 hover:text-primary'
          }
          size="sm"
          disabled={instance.connectionState === 'connecting'}
          onClick={(event) => {
            event.stopPropagation()

            if (canDisconnect) {
              onDisconnect(instance)
              return
            }

            onConnect(instance)
          }}
        >
          {primaryActionLabel}
        </Button>
      </div>
    </article>
  )
}

export default OpenClawInstanceCard
