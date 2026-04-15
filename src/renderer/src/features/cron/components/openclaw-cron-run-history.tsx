import { Loader2 } from 'lucide-react'

import { useOpenClawCronRunHistory } from '@/features/cron/lib/use-openclaw-cron-run-history'
import {
  formatOpenClawCronAbsoluteTimestamp,
  formatOpenClawCronDuration
} from '@/features/cron/lib/openclaw-cron-presenters'
import type { OpenClawCronRunLogEntry } from '@/features/cron/lib/openclaw-cron-types'
import MarkdownContent from '@/features/chat/components/markdown-content'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

type OpenClawCronRunHistoryProps = {
  instanceId: string | null
  jobId: string | null
  enabled: boolean
  refreshToken?: string | number | boolean | null
  className?: string
  innerClassName?: string
  emptyTitle?: string
  emptyDescription?: string
}

type AppTranslator = ReturnType<typeof useAppI18n>['t']

function resolveRunDurationLabel(
  entry: OpenClawCronRunLogEntry | undefined,
  t: AppTranslator
): string {
  if (!entry) {
    return t('cron.runHistory.durationUnknown')
  }

  if (typeof entry.durationMs === 'number' && Number.isFinite(entry.durationMs)) {
    return t('cron.runHistory.durationValue', {
      duration: formatOpenClawCronDuration(Math.max(0, entry.durationMs))
    })
  }

  return t('cron.runHistory.durationUnknown')
}

function resolveRunTimestamp(entry: OpenClawCronRunLogEntry | undefined, t: AppTranslator): string {
  if (!entry) {
    return t('cron.runHistory.timestampFallback')
  }

  return formatOpenClawCronAbsoluteTimestamp(entry.runAtMs ?? entry.ts)
}

function OpenClawCronRunHistory({
  instanceId,
  jobId,
  enabled,
  refreshToken,
  className,
  innerClassName,
  emptyTitle,
  emptyDescription
}: OpenClawCronRunHistoryProps): React.JSX.Element {
  const { t } = useAppI18n()
  const resolvedEmptyTitle = emptyTitle ?? t('cron.runHistory.emptyTitle')
  const resolvedEmptyDescription = emptyDescription ?? t('cron.runHistory.emptyDescription')
  const history = useOpenClawCronRunHistory(instanceId, jobId, enabled, refreshToken)

  if (!enabled || !instanceId || !jobId) {
    return <section className={cn('min-h-0 flex-1', className)} />
  }

  if (history.loading && history.items.length === 0) {
    return (
      <section
        className={cn('flex min-h-0 flex-1 flex-col items-center justify-center', className)}
      >
        <Loader2 className="size-5 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">{t('cron.runHistory.loading')}</p>
      </section>
    )
  }

  if (history.error) {
    return (
      <section
        className={cn('flex min-h-0 flex-1 flex-col items-center justify-center px-6', className)}
      >
        <p className="text-sm font-medium text-foreground">{t('cron.runHistory.errorTitle')}</p>
        <p className="mt-2 max-w-xl text-center text-sm leading-6 text-muted-foreground">
          {history.error}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-5 h-9 rounded-[0.7rem] px-3 text-sm"
          onClick={() => {
            void history.refetch()
          }}
        >
          {t('cron.runHistory.retry')}
        </Button>
      </section>
    )
  }

  if (history.items.length === 0) {
    return (
      <section
        className={cn('flex min-h-0 flex-1 flex-col items-center justify-center px-6', className)}
      >
        <div className="max-w-md text-center">
          <p className="text-sm font-medium text-foreground">{resolvedEmptyTitle}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{resolvedEmptyDescription}</p>
        </div>
      </section>
    )
  }

  return (
    <section className={cn('min-h-0 flex-1 overflow-y-auto', className)}>
      <div className={cn('divide-y divide-black/8', innerClassName)}>
        {history.items.map((item) => {
          const durationLabel = resolveRunDurationLabel(item.entry, t)

          return (
            <article key={item.id} className="px-4 py-3">
              <header className="flex items-center justify-between gap-3">
                <span className="text-xs text-foreground">{resolveRunTimestamp(item.entry, t)}</span>
                <span className="text-xs text-muted-foreground">{durationLabel}</span>
              </header>

              <div className="mt-2.5 space-y-2.5">
                {item.outputs.length === 0 ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t('cron.runHistory.emptyOutput')}
                  </p>
                ) : (
                  item.outputs.map((output, outputIndex) => (
                    <div
                      key={`${item.id}-output-${outputIndex}`}
                      className="rounded-[0.6rem] bg-[#F6F8FC] px-3 py-2.5"
                    >
                      <MarkdownContent
                        content={output}
                        className="text-sm leading-6 text-foreground"
                      />
                    </div>
                  ))
                )}
              </div>

              {item.historyError ? (
                <p className="mt-2 text-xs text-amber-700">
                  {t('cron.runHistory.historyFallback')}
                </p>
              ) : null}
            </article>
          )
        })}

        {history.hasMore ? (
          <div className="flex justify-center px-4 py-3">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-[0.7rem] px-3 text-sm"
              disabled={history.loadingMore}
              onClick={() => {
                void history.loadMore()
              }}
            >
              {history.loadingMore ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('cron.runHistory.loadingMore')}
                </>
              ) : (
                t('cron.runHistory.loadMore')
              )}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default OpenClawCronRunHistory
