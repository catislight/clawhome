import { AlertTriangle, ChevronDown, Copy, Loader2, RefreshCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  buildOpenClawLogCopyText,
  buildOpenClawLogKindFilterOptions,
  buildOpenClawLogLevelFilterOptions,
  filterOpenClawLogs,
  formatOpenClawLogTimestamp,
  resolveOpenClawLogKindLabel,
  resolveOpenClawLogLevelDotClassName,
  resolveOpenClawLogLevelLabel,
  resolveOpenClawLogMessage,
  resolveOpenClawLogLevelTagClassName,
  summarizeOpenClawLogStats,
  type OpenClawGatewayDebugLogEntry,
  type OpenClawLogKindFilter,
  type OpenClawLogLevelFilter
} from '@/features/logs/lib/openclaw-observability-presenters'
import { useOpenClawObservabilityLogs } from '@/features/logs/lib/use-openclaw-observability-logs'
import OpenClawConnectionStatePanel from '@/features/instances/components/openclaw-connection-state-panel'
import OpenClawNoInstanceState from '@/features/instances/components/openclaw-no-instance-state'
import { useOpenClawConnectionActions } from '@/features/instances/lib/use-openclaw-connection-actions'
import { useWorkspaceInstanceSelection } from '@/features/instances/lib/use-workspace-instance-selection'
import { useAppStore } from '@/features/instances/store/use-app-store'
import { useCopyToClipboard } from '@/shared/hooks/use-copy-to-clipboard'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import AppShellContentArea from '@/shared/layout/app-shell-content-area'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'

function OpenClawLogsPage(): React.JSX.Element {
  const { t } = useAppI18n()
  const navigate = useNavigate()
  const instances = useAppStore((state) => state.instances)
  const { connectInstance } = useOpenClawConnectionActions()
  const { selectedInstance } = useWorkspaceInstanceSelection()
  const [reconnectingInstanceId, setReconnectingInstanceId] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [levelFilter, setLevelFilter] = useState<OpenClawLogLevelFilter>('all')
  const [kindFilter, setKindFilter] = useState<OpenClawLogKindFilter>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null)
  const { copy } = useCopyToClipboard()

  const selectedInstanceConnected = selectedInstance?.connectionState === 'connected'
  const selectedInstanceRequiresConnectionConfig =
    selectedInstance && selectedInstance.connectionConfig === null

  const logsController = useOpenClawObservabilityLogs({
    instanceId: selectedInstanceConnected ? selectedInstance.id : null,
    enabled: selectedInstanceConnected,
    autoRefresh
  })

  const filteredLogs = useMemo(
    () =>
      filterOpenClawLogs(logsController.logs, {
        keyword,
        level: levelFilter,
        kind: kindFilter
      }),
    [kindFilter, keyword, levelFilter, logsController.logs]
  )
  const logStats = useMemo(
    () => summarizeOpenClawLogStats(logsController.logs),
    [logsController.logs]
  )
  const levelFilterOptions = useMemo(() => buildOpenClawLogLevelFilterOptions(), [t])
  const kindFilterOptions = useMemo(() => buildOpenClawLogKindFilterOptions(), [t])

  const handleCopyLog = (log: OpenClawGatewayDebugLogEntry): void => {
    void copy(buildOpenClawLogCopyText(log)).then((copied) => {
      if (!copied) {
        return
      }

      setCopiedLogId(log.id)
      window.setTimeout(() => {
        setCopiedLogId((current) => (current === log.id ? null : current))
      }, 1_400)
    })
  }

  return (
    <AppShellContentArea
      disableInnerPadding
      contentScrollable={false}
      innerClassName="h-full min-h-0 gap-0"
    >
      {instances.length === 0 ? (
        <OpenClawNoInstanceState
          message={t('logs.page.noInstance')}
          onOpenConfig={() => navigate('/config')}
        />
      ) : !selectedInstance ? null : selectedInstanceRequiresConnectionConfig ||
        !selectedInstanceConnected ? (
        <OpenClawConnectionStatePanel
          instance={selectedInstance}
          reconnectPending={reconnectingInstanceId === selectedInstance.id}
          descriptionOverride={t('logs.page.needConnectionDescription')}
          onReconnect={(instance) => {
            setReconnectingInstanceId(instance.id)
            void connectInstance(instance, {
              optimisticConnecting: false
            }).finally(() => {
              setReconnectingInstanceId((current) => (current === instance.id ? null : current))
            })
          }}
          onOpenConfig={() => navigate('/config')}
        />
      ) : (
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-4">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-black/6 pb-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="truncate font-medium text-foreground">{selectedInstance.name}</span>
              <span className="inline-flex items-center gap-1">
                {t('logs.stats.total')}
                <strong className="font-semibold text-foreground">{logStats.total}</strong>
              </span>
              <span className="inline-flex items-center gap-1">
                {t('logs.stats.error')}
                <strong className="font-semibold text-rose-600">{logStats.error}</strong>
              </span>
              <span className="inline-flex items-center gap-1">
                {t('logs.stats.warn')}
                <strong className="font-semibold text-amber-600">{logStats.warn}</strong>
              </span>
              {logsController.lastUpdatedAt ? (
                <>
                  <span aria-hidden="true" className="h-3.5 w-px bg-black/10" />
                  <span>
                    {t('logs.stats.updatedAt', {
                      time: formatOpenClawLogTimestamp(logsController.lastUpdatedAt)
                    })}
                  </span>
                </>
              ) : null}
              {logsController.refreshing ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" />
                  {t('logs.stats.refreshing')}
                </span>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={logsController.refreshing ? t('logs.action.refreshing') : t('logs.action.refresh')}
                title={logsController.refreshing ? t('logs.action.refreshing') : t('logs.action.refresh')}
                className="size-8 rounded-[0.65rem] text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"
                disabled={
                  logsController.loading || logsController.refreshing || logsController.clearing
                }
                onClick={() => {
                  void logsController.refresh()
                }}
              >
                <RefreshCcw
                  className={cn('size-3.5', logsController.refreshing && 'animate-spin')}
                />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={logsController.clearing ? t('logs.action.clearing') : t('logs.action.clear')}
                title={logsController.clearing ? t('logs.action.clearing') : t('logs.action.clear')}
                className="size-8 rounded-[0.65rem] text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                disabled={logsController.clearing || logsController.logs.length === 0}
                onClick={() => {
                  void logsController.clearLogs()
                }}
              >
                {logsController.clearing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </Button>

              <div aria-hidden="true" className="mx-0.5 h-5 w-px bg-black/10" />

              <label className="ml-0.5 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <span>{t('logs.autoRefresh')}</span>
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              </label>
            </div>
          </div>

          <div className="mt-3 grid shrink-0 gap-2 md:grid-cols-[minmax(0,1fr)_9.5rem_9.5rem]">
            <Input
              density="sm"
              value={keyword}
              placeholder={t('logs.search.placeholder')}
              onChange={(event) => {
                setKeyword(event.target.value)
              }}
            />

            <Select
              value={levelFilter}
              options={levelFilterOptions}
              ariaLabel={t('logs.filter.level.aria')}
              onValueChange={(value) => {
                setLevelFilter(value as OpenClawLogLevelFilter)
              }}
            />

            <Select
              value={kindFilter}
              options={kindFilterOptions}
              ariaLabel={t('logs.filter.kind.aria')}
              onValueChange={(value) => {
                setKindFilter(value as OpenClawLogKindFilter)
              }}
            />
          </div>

          {logsController.error ? (
            <section className="mt-3 flex items-start gap-2 rounded-[0.7rem] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{logsController.error}</p>
            </section>
          ) : null}

          <section className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[0.8rem] border border-black/8 bg-white">
            {logsController.loading ? (
              <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t('logs.loading')}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-medium text-foreground">
                  {logsController.logs.length === 0 ? t('logs.empty.none') : t('logs.empty.filtered')}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {logsController.logs.length === 0
                    ? t('logs.empty.noneDescription')
                    : t('logs.empty.filteredDescription')}
                </p>
              </div>
            ) : (
              <div className="h-full overflow-y-auto">
                {filteredLogs.map((log) => {
                  const expanded = expandedLogId === log.id

                  return (
                    <article key={log.id} className="border-b border-black/6 last:border-b-0">
                      <button
                        type="button"
                        className="w-full px-4 py-3 text-left transition-colors hover:bg-black/[0.02]"
                        onClick={() => {
                          setExpandedLogId((current) => (current === log.id ? null : log.id))
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              'mt-[7px] size-2 shrink-0 rounded-full',
                              resolveOpenClawLogLevelDotClassName(log.level)
                            )}
                            aria-hidden="true"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {resolveOpenClawLogKindLabel(log.kind)}
                              </span>
                              <span className="truncate">{log.source}</span>
                              <span>{formatOpenClawLogTimestamp(log.receivedAt)}</span>
                              {log.requestId ? (
                                <span className="truncate text-[11px]">
                                  {t('logs.requestId.prefix')} {log.requestId}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm leading-5 text-foreground">
                              {resolveOpenClawLogMessage(log.message)}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex rounded border px-1.5 py-[1px] text-[10px] font-medium',
                                resolveOpenClawLogLevelTagClassName(log.level)
                              )}
                            >
                              {resolveOpenClawLogLevelLabel(log.level)}
                            </span>
                            <ChevronDown
                              className={cn(
                                'size-4 text-muted-foreground transition-transform',
                                expanded && 'rotate-180'
                              )}
                            />
                          </div>
                        </div>
                      </button>

                      {expanded ? (
                        <div className="border-t border-black/6 bg-[#FAFBFD] px-4 py-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                              {log.payloadText ? t('logs.payload.detail') : t('logs.payload.noneDetail')}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-[0.55rem] px-2 text-xs"
                              disabled={!log.payloadText}
                              onClick={() => {
                                handleCopyLog(log)
                              }}
                            >
                              <Copy className="size-3.5" />
                              {copiedLogId === log.id ? t('logs.copy.copied') : t('logs.copy.copy')}
                            </Button>
                          </div>

                          <pre className="max-h-52 overflow-auto rounded-[0.65rem] border border-black/8 bg-white px-3 py-2 text-[12px] leading-5 text-slate-700">
                            {log.payloadText ?? t('logs.payload.none')}
                          </pre>
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </section>
      )}
    </AppShellContentArea>
  )
}

export default OpenClawLogsPage
