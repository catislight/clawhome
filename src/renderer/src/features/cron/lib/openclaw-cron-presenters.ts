import type {
  OpenClawCronDeliveryStatus,
  OpenClawCronJob,
  OpenClawCronSchedule,
  OpenClawCronVisualStatus
} from '@/features/cron/lib/openclaw-cron-types'
import { getOpenClawCronJobRunStatus } from '@/features/cron/lib/openclaw-cron-job-status'
import { getCurrentAppLanguage, translateWithAppLanguage, type AppI18nKey } from '@/shared/i18n/app-i18n'

function t(
  key: AppI18nKey,
  params?: Record<string, string | number | null | undefined>
): string {
  return translateWithAppLanguage(key, params)
}

function getDateTimeLocale(): string {
  return getCurrentAppLanguage()
}

function formatDateTime(value: number): string {
  return new Intl.DateTimeFormat(getDateTimeLocale(), {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

export function formatOpenClawCronTimestamp(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return t('cron.presenter.timestamp.unscheduled')
  }

  return formatDateTime(value)
}

export function formatOpenClawCronAbsoluteTimestamp(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return t('cron.presenter.timestamp.noRecords')
  }

  return new Intl.DateTimeFormat(getDateTimeLocale(), {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

export function formatOpenClawCronCountdown(
  value: number | undefined,
  nowMs: number = Date.now()
): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return t('cron.presenter.countdown.unscheduled')
  }

  const diffMs = value - nowMs
  if (diffMs <= 0) {
    return t('cron.presenter.countdown.soon')
  }

  const totalSeconds = Math.floor(diffMs / 1_000)
  if (totalSeconds < 60) {
    return t('cron.presenter.countdown.seconds', { seconds: totalSeconds })
  }

  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return t('cron.presenter.countdown.daysHours', { days, hours })
  }

  if (hours > 0) {
    return t('cron.presenter.countdown.hoursMinutes', { hours, minutes })
  }

  return t('cron.presenter.countdown.minutesSeconds', { minutes, seconds })
}

export function formatOpenClawCronDuration(ms: number): string {
  if (ms < 1_000) {
    return `${ms}ms`
  }

  const totalSeconds = Math.floor(ms / 1_000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return `${days}d ${hours}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

export function formatOpenClawCronScheduleSummary(schedule: OpenClawCronSchedule): string {
  if (schedule.kind === 'at') {
    const atDate = Date.parse(schedule.at)
    return Number.isNaN(atDate)
      ? t('cron.presenter.schedule.onceRaw', { value: schedule.at })
      : t('cron.presenter.schedule.onceFormatted', { value: formatDateTime(atDate) })
  }

  if (schedule.kind === 'every') {
    return t('cron.presenter.schedule.every', {
      value: formatOpenClawCronDuration(schedule.everyMs)
    })
  }

  const timezone = schedule.tz?.trim()
  if (timezone) {
    return t('cron.presenter.schedule.cronWithTimezone', {
      expr: schedule.expr,
      tz: timezone
    })
  }

  return t('cron.presenter.schedule.cron', { expr: schedule.expr })
}

function isDeliveryRelatedFailure(job: OpenClawCronJob): boolean {
  const deliveryStatus = job.state.lastDeliveryStatus
  const lastError = job.state.lastError?.trim().toLowerCase() ?? ''

  if (
    deliveryStatus === 'not-delivered' ||
    deliveryStatus === 'unknown' ||
    deliveryStatus === 'delivered'
  ) {
    return true
  }

  return (
    lastError.includes('channel is required') ||
    lastError.includes('delivery') ||
    lastError.includes('no configured channels detected')
  )
}

export function getOpenClawCronJobVisualStatus(params: {
  job: OpenClawCronJob
  runSyncing?: boolean
  hasRecentOutput?: boolean
}): OpenClawCronVisualStatus {
  const { job, runSyncing = false, hasRecentOutput } = params

  if (!job.enabled) {
    return 'idle'
  }

  if (runSyncing || typeof job.state.runningAtMs === 'number') {
    return 'running'
  }

  const runStatus = getOpenClawCronJobRunStatus(job)
  if (runStatus === 'skipped') {
    return 'skipped'
  }

  if (job.sessionTarget === 'isolated' && typeof job.state.lastRunAtMs === 'number') {
    if (hasRecentOutput === true) {
      return 'success'
    }

    if (hasRecentOutput === false) {
      return 'error'
    }

    if (runStatus === 'ok') {
      return 'success'
    }

    if (runStatus === 'error' && isDeliveryRelatedFailure(job)) {
      return 'success'
    }

    if (runStatus === 'error') {
      return 'error'
    }

    return 'idle'
  }

  if (runStatus === 'ok') {
    return 'success'
  }
  if (runStatus === 'error') {
    return 'error'
  }

  return 'idle'
}

export function getOpenClawCronJobStatusLabel(params: {
  job: OpenClawCronJob
  runSyncing?: boolean
  hasRecentOutput?: boolean
}): string {
  const visualStatus = getOpenClawCronJobVisualStatus(params)

  if (visualStatus === 'idle') {
    return params.job.enabled ? t('cron.presenter.status.enabled') : t('cron.presenter.status.disabled')
  }

  if (visualStatus === 'running') {
    return t('cron.presenter.status.running')
  }

  if (visualStatus === 'success') {
    return t('cron.presenter.status.success')
  }

  if (visualStatus === 'skipped') {
    return t('cron.presenter.status.skipped')
  }

  return t('cron.presenter.status.failed')
}

export function getOpenClawCronJobStatusClassName(params: {
  job: OpenClawCronJob
  runSyncing?: boolean
  hasRecentOutput?: boolean
}): string {
  const visualStatus = getOpenClawCronJobVisualStatus(params)

  if (visualStatus === 'idle') {
    if (!params.job.enabled) {
      return 'border-slate-200 bg-slate-100 text-slate-600'
    }

    return 'border-sky-200 bg-sky-50 text-sky-700'
  }

  if (visualStatus === 'running') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }

  if (visualStatus === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  if (visualStatus === 'skipped') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }

  return 'border-rose-200 bg-rose-50 text-rose-700'
}

export function getOpenClawCronSecondaryError(params: {
  job: OpenClawCronJob
  hasRecentOutput?: boolean
}): {
  tone: 'muted' | 'error'
  text: string
} | null {
  const { job, hasRecentOutput } = params
  const lastError = job.state.lastError?.trim()

  if (!lastError) {
    return null
  }

  if (hasRecentOutput && isDeliveryRelatedFailure(job)) {
    const deliveryStatus: OpenClawCronDeliveryStatus | undefined = job.state.lastDeliveryStatus

    if (deliveryStatus === 'not-requested') {
      return null
    }

    return {
      tone: 'muted',
      text: t('cron.presenter.deliveryFailed', { error: lastError })
    }
  }

  return {
    tone: 'error',
    text: lastError
  }
}

export function getOpenClawCronLastRunLabel(params: {
  job: OpenClawCronJob
  hasRecentOutput?: boolean
}): string | null {
  const { job, hasRecentOutput } = params

  if (job.sessionTarget === 'isolated' && typeof job.state.lastRunAtMs === 'number') {
    if (hasRecentOutput === true) {
      return t('cron.presenter.lastRun.withOutput')
    }
    if (hasRecentOutput === false) {
      return t('cron.presenter.lastRun.withoutOutput')
    }
  }

  const runStatus = getOpenClawCronJobRunStatus(job)
  if (runStatus === 'ok') {
    return t('cron.presenter.lastRun.success')
  }
  if (runStatus === 'error') {
    return t('cron.presenter.lastRun.failed')
  }
  if (runStatus === 'skipped') {
    return t('cron.presenter.lastRun.skipped')
  }

  return null
}

export function getOpenClawCronPayloadSummary(job: OpenClawCronJob): string {
  if (job.payload.kind === 'systemEvent') {
    return job.payload.text.trim()
  }

  return job.payload.message.trim()
}

export function getOpenClawCronSessionTargetLabel(job: OpenClawCronJob): string {
  return job.sessionTarget === 'isolated'
    ? t('cron.presenter.sessionTarget.isolated')
    : t('cron.presenter.sessionTarget.main')
}

export function getOpenClawCronWakeModeLabel(job: OpenClawCronJob): string {
  return job.wakeMode === 'next-heartbeat'
    ? t('cron.presenter.wakeMode.nextHeartbeat')
    : t('cron.presenter.wakeMode.now')
}
