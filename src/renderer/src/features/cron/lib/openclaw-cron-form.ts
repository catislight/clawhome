import type {
  OpenClawCronFormValues,
  OpenClawCronJob
} from '@/features/cron/lib/openclaw-cron-types'
import {
  OPENCLAW_CRON_DEFAULT_AT_DELAY_MS,
  OPENCLAW_CRON_DEFAULT_CRON_EXPRESSION,
  OPENCLAW_CRON_DEFAULT_DELIVERY_CHANNEL,
  OPENCLAW_CRON_DEFAULT_EVERY_INTERVAL
} from '@/features/cron/lib/openclaw-cron-constants'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

function formatLocalDateTimeInput(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date(Date.now() + OPENCLAW_CRON_DEFAULT_AT_DELAY_MS)
    return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-${String(fallback.getDate()).padStart(2, '0')}T${String(fallback.getHours()).padStart(2, '0')}:${String(fallback.getMinutes()).padStart(2, '0')}`
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function trimValue(value: string): string {
  return value.trim()
}

function createDefaultAtDateTimeInput(): string {
  return formatLocalDateTimeInput(
    new Date(Date.now() + OPENCLAW_CRON_DEFAULT_AT_DELAY_MS).toISOString()
  )
}

export function parseOpenClawCronDurationMs(input: string): number | null {
  const normalized = input.trim().toLowerCase()
  const match = normalized.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/)

  if (!match) {
    return null
  }

  const numericValue = Number(match[1])
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null
  }

  const unit = match[2]
  const factor =
    unit === 'ms'
      ? 1
      : unit === 's'
        ? 1_000
        : unit === 'm'
          ? 60_000
          : unit === 'h'
            ? 3_600_000
            : 86_400_000

  return Math.floor(numericValue * factor)
}

export function formatOpenClawCronDurationInput(ms: number): string {
  if (ms % 86_400_000 === 0) {
    return `${ms / 86_400_000}d`
  }
  if (ms % 3_600_000 === 0) {
    return `${ms / 3_600_000}h`
  }
  if (ms % 60_000 === 0) {
    return `${ms / 60_000}m`
  }
  if (ms % 1_000 === 0) {
    return `${ms / 1_000}s`
  }
  return `${ms}ms`
}

export function createInitialOpenClawCronFormValues(
  job?: OpenClawCronJob | null
): OpenClawCronFormValues {
  if (!job) {
    return {
      name: '',
      description: '',
      enabled: true,
      sessionTarget: 'isolated',
      wakeMode: 'now',
      scheduleKind: 'every',
      atDateTime: createDefaultAtDateTimeInput(),
      everyInterval: OPENCLAW_CRON_DEFAULT_EVERY_INTERVAL,
      cronExpr: OPENCLAW_CRON_DEFAULT_CRON_EXPRESSION,
      cronTz: '',
      deleteAfterRun: true,
      systemEventText: '',
      agentMessage: '',
      deliveryMode: 'announce',
      deliveryChannel: OPENCLAW_CRON_DEFAULT_DELIVERY_CHANNEL
    }
  }

  return {
    name: job.name,
    description: job.description ?? '',
    enabled: job.enabled,
    sessionTarget: job.sessionTarget,
    wakeMode: job.wakeMode,
    scheduleKind: job.schedule.kind,
    atDateTime:
      job.schedule.kind === 'at'
        ? formatLocalDateTimeInput(job.schedule.at)
        : createDefaultAtDateTimeInput(),
    everyInterval:
      job.schedule.kind === 'every'
        ? formatOpenClawCronDurationInput(job.schedule.everyMs)
        : OPENCLAW_CRON_DEFAULT_EVERY_INTERVAL,
    cronExpr:
      job.schedule.kind === 'cron' ? job.schedule.expr : OPENCLAW_CRON_DEFAULT_CRON_EXPRESSION,
    cronTz: job.schedule.kind === 'cron' ? (job.schedule.tz ?? '') : '',
    deleteAfterRun: job.deleteAfterRun ?? true,
    systemEventText: job.payload.kind === 'systemEvent' ? job.payload.text : '',
    agentMessage: job.payload.kind === 'agentTurn' ? job.payload.message : '',
    deliveryMode: job.delivery?.mode === 'announce' ? 'announce' : 'none',
    deliveryChannel: job.delivery?.channel ?? OPENCLAW_CRON_DEFAULT_DELIVERY_CHANNEL
  }
}

function buildSchedule(values: OpenClawCronFormValues): Record<string, unknown> {
  if (values.scheduleKind === 'at') {
    const date = new Date(values.atDateTime)
    if (Number.isNaN(date.getTime())) {
      throw new Error(translateWithAppLanguage('cron.error.form.invalidAt'))
    }

    return {
      kind: 'at',
      at: date.toISOString()
    }
  }

  if (values.scheduleKind === 'every') {
    const everyMs = parseOpenClawCronDurationMs(values.everyInterval)
    if (everyMs === null) {
      throw new Error(translateWithAppLanguage('cron.error.form.invalidEveryInterval'))
    }

    return {
      kind: 'every',
      everyMs
    }
  }

  const cronExpr = trimValue(values.cronExpr)
  if (!cronExpr) {
    throw new Error(translateWithAppLanguage('cron.error.form.requiredCronExpr'))
  }

  return {
    kind: 'cron',
    expr: cronExpr,
    ...(trimValue(values.cronTz) ? { tz: trimValue(values.cronTz) } : {})
  }
}

function buildPayload(values: OpenClawCronFormValues): Record<string, unknown> {
  if (values.sessionTarget === 'main') {
    const text = trimValue(values.systemEventText)
    if (!text) {
      throw new Error(translateWithAppLanguage('cron.error.form.requiredSystemEvent'))
    }

    return {
      kind: 'systemEvent',
      text
    }
  }

  const message = trimValue(values.agentMessage)
  if (!message) {
    throw new Error(translateWithAppLanguage('cron.error.form.requiredAgentMessage'))
  }

  return {
    kind: 'agentTurn',
    message
  }
}

function buildDelivery(values: OpenClawCronFormValues): Record<string, unknown> | undefined {
  if (values.sessionTarget !== 'isolated') {
    return undefined
  }

  if (values.deliveryMode === 'none') {
    return {
      mode: 'none'
    }
  }

  const channel = trimValue(values.deliveryChannel) || OPENCLAW_CRON_DEFAULT_DELIVERY_CHANNEL

  return {
    mode: 'announce',
    channel
  }
}

function buildCommonPayload(values: OpenClawCronFormValues): Record<string, unknown> {
  const name = trimValue(values.name)
  if (!name) {
    throw new Error(translateWithAppLanguage('cron.error.form.requiredName'))
  }

  return {
    name,
    description: trimValue(values.description),
    enabled: values.enabled,
    schedule: buildSchedule(values),
    sessionTarget: values.sessionTarget,
    wakeMode: values.wakeMode,
    payload: buildPayload(values),
    deleteAfterRun: values.scheduleKind === 'at' ? values.deleteAfterRun : false
  }
}

export function buildCreateOpenClawCronPayload(
  values: OpenClawCronFormValues
): Record<string, unknown> {
  const common = buildCommonPayload(values)
  const delivery = buildDelivery(values)

  return {
    ...common,
    ...(delivery ? { delivery } : {})
  }
}

export function buildUpdateOpenClawCronPatch(
  values: OpenClawCronFormValues,
  existingJob: OpenClawCronJob
): Record<string, unknown> {
  const common = buildCommonPayload(values)
  const delivery = buildDelivery(values)

  return {
    name: common.name,
    description: common.description,
    enabled: common.enabled,
    schedule: common.schedule,
    sessionTarget: common.sessionTarget,
    wakeMode: common.wakeMode,
    payload: common.payload,
    deleteAfterRun:
      values.scheduleKind === 'at' || existingJob.deleteAfterRun !== undefined
        ? common.deleteAfterRun
        : undefined,
    ...(delivery ? { delivery } : {})
  }
}
