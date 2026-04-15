import { Loader2, Plus } from 'lucide-react'
import { memo, useEffect, useState } from 'react'

import { Button } from '@/shared/ui/button'
import { OverflowMenu } from '@/shared/ui/overflow-menu'
import { cn } from '@/shared/lib/utils'
import { OPENCLAW_CRON_SIDEBAR_COUNTDOWN_REFRESH_INTERVAL_MS } from '@/features/cron/lib/openclaw-cron-constants'
import {
  formatOpenClawCronAbsoluteTimestamp,
  formatOpenClawCronCountdown,
  getOpenClawCronJobStatusLabel,
  getOpenClawCronJobVisualStatus
} from '@/features/cron/lib/openclaw-cron-presenters'
import type { OpenClawCronJob } from '@/features/cron/lib/openclaw-cron-types'
import { useAppI18n } from '@/shared/i18n/app-i18n'

type OpenClawCronJobsSidebarProps = {
  jobs: OpenClawCronJob[]
  selectedJobId: string | null
  loading?: boolean
  syncingRunJobIds: string[]
  jobHasRecentOutputById: Record<string, boolean>
  mutateKey: string | null
  onSelectJob: (jobId: string) => void
  onRunJob: (job: OpenClawCronJob) => void
  onEditJob: (job: OpenClawCronJob) => void
  onDeleteJob: (job: OpenClawCronJob) => void
  onCreateJob: () => void
}

function resolveStatusDotClassName(job: OpenClawCronJob, visualStatus: string): string {
  if (!job.enabled) {
    return 'bg-slate-300'
  }

  if (visualStatus === 'success') {
    return 'bg-emerald-500'
  }

  if (visualStatus === 'error') {
    return 'bg-rose-500'
  }

  if (visualStatus === 'running') {
    return 'bg-amber-500'
  }

  return 'bg-slate-300'
}

type OpenClawCronSidebarItemProps = {
  job: OpenClawCronJob
  jobId: string
  name: string
  selected: boolean
  statusLabel: string
  statusDotClassName: string
  nextRunAtMs?: number
  nextRunLabel: string
  runActionLabel: string
  editActionLabel: string
  deleteActionLabel: string
  moreActionLabel: string
  runActionDisabled: boolean
  editActionDisabled: boolean
  deleteActionDisabled: boolean
  onSelectJob: (jobId: string) => void
  onRunJob: (job: OpenClawCronJob) => void
  onEditJob: (job: OpenClawCronJob) => void
  onDeleteJob: (job: OpenClawCronJob) => void
}

const OpenClawCronSidebarItemCountdown = memo(function OpenClawCronSidebarItemCountdown({
  nextRunAtMs,
  nextRunLabel
}: {
  nextRunAtMs?: number
  nextRunLabel: string
}): React.JSX.Element {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, OPENCLAW_CRON_SIDEBAR_COUNTDOWN_REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  return (
    <span className="shrink-0 text-muted-foreground" title={nextRunLabel}>
      {formatOpenClawCronCountdown(nextRunAtMs, nowMs)}
    </span>
  )
})

const OpenClawCronSidebarItem = memo(function OpenClawCronSidebarItem({
  job,
  jobId,
  name,
  selected,
  statusLabel,
  statusDotClassName,
  nextRunAtMs,
  nextRunLabel,
  runActionLabel,
  editActionLabel,
  deleteActionLabel,
  moreActionLabel,
  runActionDisabled,
  editActionDisabled,
  deleteActionDisabled,
  onSelectJob,
  onRunJob,
  onEditJob,
  onDeleteJob
}: OpenClawCronSidebarItemProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'relative w-full rounded-[0.7rem] transition-colors',
        selected ? 'bg-primary/10' : 'hover:bg-white'
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        className="w-full px-3 py-2.5 text-left"
        onClick={() => onSelectJob(jobId)}
      >
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <span
              className={cn('size-2 shrink-0 rounded-full', statusDotClassName)}
              aria-hidden="true"
            />
            <span className="truncate">{statusLabel}</span>
          </span>
          <OpenClawCronSidebarItemCountdown nextRunAtMs={nextRunAtMs} nextRunLabel={nextRunLabel} />
        </div>
      </button>

      <OverflowMenu
        className="absolute top-1.5 right-1.5"
        triggerLabel={moreActionLabel}
        renderInPortal
        triggerClassName="size-7 hover:bg-black/10"
        items={[
          {
            key: 'run',
            label: runActionLabel,
            disabled: runActionDisabled,
            onSelect: () => onRunJob(job)
          },
          {
            key: 'edit',
            label: editActionLabel,
            disabled: editActionDisabled,
            onSelect: () => onEditJob(job)
          },
          {
            key: 'delete',
            label: deleteActionLabel,
            disabled: deleteActionDisabled,
            onSelect: () => onDeleteJob(job)
          }
        ]}
      />
    </div>
  )
})

function OpenClawCronJobsSidebar({
  jobs,
  selectedJobId,
  loading = false,
  syncingRunJobIds,
  jobHasRecentOutputById,
  mutateKey,
  onSelectJob,
  onRunJob,
  onEditJob,
  onDeleteJob,
  onCreateJob
}: OpenClawCronJobsSidebarProps): React.JSX.Element {
  const { t } = useAppI18n()

  return (
    <aside className="flex h-full min-h-0 w-[280px] shrink-0 flex-col border-r border-black/6 bg-[#FBFCFF]">
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-black/6 px-3">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">
            {t('cron.sidebar.title')}
          </p>
          <p className="shrink-0 translate-y-[1px] text-[11px] text-muted-foreground">
            {t('cron.sidebar.count', { count: jobs.length })}
          </p>
        </div>

        <Button
          type="button"
          size="icon"
          className="size-8 rounded-[0.7rem]"
          aria-label={t('cron.sidebar.create')}
          title={t('cron.sidebar.create')}
          onClick={onCreateJob}
        >
          <Plus className="size-3.5" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex h-full min-h-[180px] items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {t('cron.sidebar.loading')}
            </div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-[0.7rem] bg-white px-3 py-2.5 text-xs text-muted-foreground">
            {t('cron.sidebar.empty')}
          </div>
        ) : (
          <div className="space-y-1.5">
            {jobs.map((job) => {
              const runSyncing = syncingRunJobIds.includes(job.id)
              const hasRecentOutput = jobHasRecentOutputById[job.id]
              const runBusy = mutateKey === `run:${job.id}`
              const toggleBusy = mutateKey === `update:${job.id}`
              const removeBusy = mutateKey === `remove:${job.id}`
              const runPending = runBusy || runSyncing
              const visualStatus = getOpenClawCronJobVisualStatus({
                job,
                runSyncing: runPending,
                hasRecentOutput
              })
              const statusLabel = getOpenClawCronJobStatusLabel({
                job,
                runSyncing: runPending,
                hasRecentOutput
              })
              const nextRunAtMs =
                typeof job.state.nextRunAtMs === 'number' ? job.state.nextRunAtMs : undefined
              const nextRunLabel = formatOpenClawCronAbsoluteTimestamp(nextRunAtMs)

              return (
                <OpenClawCronSidebarItem
                  key={job.id}
                  job={job}
                  jobId={job.id}
                  name={job.name}
                  selected={selectedJobId === job.id}
                  statusLabel={statusLabel}
                  statusDotClassName={resolveStatusDotClassName(job, visualStatus)}
                  nextRunAtMs={nextRunAtMs}
                  nextRunLabel={nextRunLabel}
                  moreActionLabel={t('cron.sidebar.moreActions', { name: job.name })}
                  runActionLabel={
                    runBusy
                      ? t('cron.sidebar.action.runBusy')
                      : runSyncing
                        ? t('cron.sidebar.action.runSyncing')
                        : t('cron.sidebar.action.run')
                  }
                  editActionLabel={
                    toggleBusy ? t('cron.sidebar.action.editBusy') : t('cron.sidebar.action.edit')
                  }
                  deleteActionLabel={
                    removeBusy
                      ? t('cron.sidebar.action.deleteBusy')
                      : t('cron.sidebar.action.delete')
                  }
                  runActionDisabled={runPending}
                  editActionDisabled={toggleBusy || removeBusy}
                  deleteActionDisabled={removeBusy || toggleBusy}
                  onSelectJob={onSelectJob}
                  onRunJob={onRunJob}
                  onEditJob={onEditJob}
                  onDeleteJob={onDeleteJob}
                />
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}

export default OpenClawCronJobsSidebar
