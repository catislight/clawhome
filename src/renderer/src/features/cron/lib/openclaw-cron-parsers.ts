import type {
  OpenClawCronDelivery,
  OpenClawCronDeliveryMode,
  OpenClawCronDeliveryStatus,
  OpenClawCronJob,
  OpenClawCronRunLogEntry,
  OpenClawCronRunLogUsage,
  OpenClawCronRunsPage,
  OpenClawCronJobState,
  OpenClawCronPayload,
  OpenClawCronRunStatus,
  OpenClawCronSchedule,
  OpenClawCronSchedulerStatus,
  OpenClawCronSessionTarget,
  OpenClawCronWakeMode
} from '@/features/cron/lib/openclaw-cron-types'
import { isSilentAssistantReply } from '@/features/chat/lib/gateway-chat'
import {
  isInternalMemoryFlushPrompt,
  sanitizeGatewayHistoryUserMessage
} from '@/features/chat/lib/gateway-chat-sanitize'
import type { ConversationMessage } from '@/shared/contracts/chat-conversation'
import { stripAssistantInternalScaffolding } from '@/shared/text/assistant-visible-text'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseCronRunStatus(value: unknown): OpenClawCronRunStatus | undefined {
  return value === 'ok' || value === 'error' || value === 'skipped' ? value : undefined
}

function parseCronDeliveryStatus(value: unknown): OpenClawCronDeliveryStatus | undefined {
  return value === 'delivered' ||
    value === 'not-delivered' ||
    value === 'unknown' ||
    value === 'not-requested'
    ? value
    : undefined
}

function parseCronSchedule(value: unknown): OpenClawCronSchedule | null {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return null
  }

  if (value.kind === 'at') {
    const at = readString(value.at)
    return at ? { kind: 'at', at } : null
  }

  if (value.kind === 'every') {
    const everyMs = readNumber(value.everyMs)
    if (everyMs === undefined) {
      return null
    }

    return {
      kind: 'every',
      everyMs,
      anchorMs: readNumber(value.anchorMs)
    }
  }

  if (value.kind === 'cron') {
    const expr = readString(value.expr)
    if (!expr) {
      return null
    }

    return {
      kind: 'cron',
      expr,
      tz: readString(value.tz),
      staggerMs: readNumber(value.staggerMs)
    }
  }

  return null
}

function parseCronPayload(value: unknown): OpenClawCronPayload | null {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return null
  }

  if (value.kind === 'systemEvent') {
    const text = readString(value.text)
    return text ? { kind: 'systemEvent', text } : null
  }

  if (value.kind === 'agentTurn') {
    const message = readString(value.message)
    if (!message) {
      return null
    }

    return {
      kind: 'agentTurn',
      message,
      model: readString(value.model),
      fallbacks: Array.isArray(value.fallbacks)
        ? value.fallbacks.filter(
            (item): item is string => typeof item === 'string' && item.length > 0
          )
        : undefined,
      thinking: readString(value.thinking),
      timeoutSeconds: readNumber(value.timeoutSeconds),
      allowUnsafeExternalContent: readBoolean(value.allowUnsafeExternalContent),
      lightContext: readBoolean(value.lightContext),
      deliver: readBoolean(value.deliver),
      channel: readString(value.channel),
      to: readString(value.to),
      bestEffortDeliver: readBoolean(value.bestEffortDeliver)
    }
  }

  return null
}

function parseCronDeliveryMode(value: unknown): OpenClawCronDeliveryMode | undefined {
  return value === 'none' || value === 'announce' || value === 'webhook' ? value : undefined
}

function parseCronDelivery(value: unknown): OpenClawCronDelivery | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const mode = parseCronDeliveryMode(value.mode)
  if (!mode) {
    return undefined
  }

  return {
    mode,
    channel: readString(value.channel),
    to: readString(value.to),
    accountId: readString(value.accountId),
    bestEffort: readBoolean(value.bestEffort)
  }
}

function parseCronJobState(value: unknown): OpenClawCronJobState {
  if (!isRecord(value)) {
    return {}
  }

  return {
    nextRunAtMs: readNumber(value.nextRunAtMs),
    runningAtMs: readNumber(value.runningAtMs),
    lastRunAtMs: readNumber(value.lastRunAtMs),
    lastRunStatus: parseCronRunStatus(value.lastRunStatus),
    lastStatus: parseCronRunStatus(value.lastStatus),
    lastError: readString(value.lastError),
    lastDurationMs: readNumber(value.lastDurationMs),
    consecutiveErrors: readNumber(value.consecutiveErrors),
    lastDelivered: readBoolean(value.lastDelivered),
    lastDeliveryStatus: parseCronDeliveryStatus(value.lastDeliveryStatus),
    lastDeliveryError: readString(value.lastDeliveryError)
  }
}

function parseSessionTarget(value: unknown): OpenClawCronSessionTarget | undefined {
  return value === 'main' || value === 'isolated' ? value : undefined
}

function parseWakeMode(value: unknown): OpenClawCronWakeMode | undefined {
  return value === 'now' || value === 'next-heartbeat' ? value : undefined
}

type GatewayHistoryMessageLike = {
  id?: unknown
  role?: unknown
  content?: unknown
  text?: unknown
  runId?: unknown
  createdAt?: unknown
  timestamp?: unknown
  ts?: unknown
}

function normalizeGatewayTimestamp(value: unknown): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 1_000_000_000_000 ? value : value * 1_000)
  }

  if (typeof value === 'string') {
    const numeric = Number(value)
    if (Number.isFinite(numeric) && value.trim() !== '') {
      return new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1_000)
    }

    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed)
    }
  }

  return null
}

function formatConversationTime(value: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(value)
}

function joinMarkdownTextParts(parts: string[]): string {
  const normalizedParts = parts
    .map((part) => part.replace(/\r\n/g, '\n'))
    .filter((part) => part.length > 0)

  if (normalizedParts.length === 0) {
    return ''
  }

  return normalizedParts.join('\n\n')
}

function collectTextParts(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTextParts(item))
  }

  if (!isRecord(value)) {
    return []
  }

  const partType = typeof value.type === 'string' ? value.type.toLowerCase() : ''
  if (
    (partType === 'text' || partType === 'input_text' || partType === 'output_text') &&
    typeof value.text === 'string'
  ) {
    return [value.text]
  }

  if (typeof value.text === 'string') {
    return [value.text]
  }

  if (typeof value.content === 'string') {
    return [value.content]
  }

  if (Array.isArray(value.content)) {
    return value.content.flatMap((item) => collectTextParts(item))
  }

  if (Array.isArray(value.parts)) {
    return value.parts.flatMap((item) => collectTextParts(item))
  }

  return []
}

function extractGatewayMessageText(message: unknown): string {
  return stripAssistantInternalScaffolding(joinMarkdownTextParts(collectTextParts(message)))
    .replace(/\r\n/g, '\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
}

function resolveMessageTimestamp(message: GatewayHistoryMessageLike): Date {
  return (
    normalizeGatewayTimestamp(message.createdAt) ??
    normalizeGatewayTimestamp(message.timestamp) ??
    normalizeGatewayTimestamp(message.ts) ??
    new Date()
  )
}

export function parseOpenClawCronJob(value: unknown): OpenClawCronJob | null {
  if (!isRecord(value)) {
    return null
  }

  const id = readString(value.id)
  const name = readString(value.name)
  const enabled = readBoolean(value.enabled)
  const createdAtMs = readNumber(value.createdAtMs)
  const updatedAtMs = readNumber(value.updatedAtMs)
  const schedule = parseCronSchedule(value.schedule)
  const sessionTarget = parseSessionTarget(value.sessionTarget)
  const wakeMode = parseWakeMode(value.wakeMode)
  const payload = parseCronPayload(value.payload)

  if (
    !id ||
    !name ||
    enabled === undefined ||
    createdAtMs === undefined ||
    updatedAtMs === undefined ||
    !schedule ||
    !sessionTarget ||
    !wakeMode ||
    !payload
  ) {
    return null
  }

  return {
    id,
    agentId: readString(value.agentId),
    sessionKey: readString(value.sessionKey),
    name,
    description: readString(value.description),
    enabled,
    deleteAfterRun: readBoolean(value.deleteAfterRun),
    createdAtMs,
    updatedAtMs,
    schedule,
    sessionTarget,
    wakeMode,
    payload,
    delivery: parseCronDelivery(value.delivery),
    state: parseCronJobState(value.state)
  }
}

export function parseOpenClawCronListPayload(payload: unknown): OpenClawCronJob[] {
  if (!isRecord(payload) || !Array.isArray(payload.jobs)) {
    return []
  }

  return payload.jobs.flatMap((job) => {
    const parsed = parseOpenClawCronJob(job)
    return parsed ? [parsed] : []
  })
}

export function parseOpenClawCronSchedulerStatus(
  payload: unknown
): OpenClawCronSchedulerStatus | null {
  if (!isRecord(payload)) {
    return null
  }

  const enabled = readBoolean(payload.enabled)
  const jobs = readNumber(payload.jobs)

  if (enabled === undefined || jobs === undefined) {
    return null
  }

  return {
    enabled,
    jobs,
    storePath: readString(payload.storePath),
    nextWakeAtMs: readNumber(payload.nextWakeAtMs)
  }
}

function parseCronRunLogUsage(value: unknown): OpenClawCronRunLogUsage | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const usage: OpenClawCronRunLogUsage = {
    input_tokens: readNumber(value.input_tokens),
    output_tokens: readNumber(value.output_tokens),
    total_tokens: readNumber(value.total_tokens),
    cache_read_tokens: readNumber(value.cache_read_tokens),
    cache_write_tokens: readNumber(value.cache_write_tokens)
  }
  const hasAnyUsageValue = Object.values(usage).some((entry) => typeof entry === 'number')

  return hasAnyUsageValue ? usage : undefined
}

function parseCronRunLogEntry(value: unknown): OpenClawCronRunLogEntry | null {
  if (!isRecord(value)) {
    return null
  }

  const ts = readNumber(value.ts)
  const jobId = readString(value.jobId)
  const action = value.action

  if (ts === undefined || !jobId || action !== 'finished') {
    return null
  }

  return {
    ts,
    jobId,
    action: 'finished',
    status: parseCronRunStatus(value.status),
    error: readString(value.error),
    summary: readString(value.summary),
    delivered: readBoolean(value.delivered),
    deliveryStatus: parseCronDeliveryStatus(value.deliveryStatus),
    deliveryError: readString(value.deliveryError),
    sessionId: readString(value.sessionId),
    sessionKey: readString(value.sessionKey),
    runAtMs: readNumber(value.runAtMs),
    durationMs: readNumber(value.durationMs),
    nextRunAtMs: readNumber(value.nextRunAtMs),
    model: readString(value.model),
    provider: readString(value.provider),
    usage: parseCronRunLogUsage(value.usage),
    jobName: readString(value.jobName)
  }
}

export function parseOpenClawCronRunsPage(payload: unknown): OpenClawCronRunsPage | null {
  if (!isRecord(payload)) {
    return null
  }

  if (!Array.isArray(payload.entries)) {
    return null
  }

  const total = readNumber(payload.total)
  const offset = readNumber(payload.offset)
  const limit = readNumber(payload.limit)
  const hasMore = readBoolean(payload.hasMore)

  if (total === undefined || offset === undefined || limit === undefined || hasMore === undefined) {
    return null
  }

  const entries = payload.entries.flatMap((entry) => {
    const parsed = parseCronRunLogEntry(entry)
    return parsed ? [parsed] : []
  })

  const nextOffsetRaw = payload.nextOffset
  const parsedNextOffset = nextOffsetRaw === null ? null : readNumber(nextOffsetRaw)
  if (nextOffsetRaw !== null && parsedNextOffset === undefined) {
    return null
  }
  const nextOffset = parsedNextOffset ?? null

  return {
    entries,
    total,
    offset,
    limit,
    hasMore,
    nextOffset
  }
}

export function parseOpenClawCronHistoryMessages(payload: unknown): ConversationMessage[] {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) {
    return []
  }

  return payload.messages.flatMap((message, index) => {
    if (!isRecord(message)) {
      return []
    }

    const historyMessage = message as GatewayHistoryMessageLike
    const role = typeof historyMessage.role === 'string' ? historyMessage.role.toLowerCase() : ''
    if (role !== 'assistant' && role !== 'user') {
      return []
    }

    const rawContent = extractGatewayMessageText(historyMessage)
    const sanitizedUserMessage =
      role === 'user' ? sanitizeGatewayHistoryUserMessage(rawContent) : null
    const content = role === 'user' ? (sanitizedUserMessage?.content ?? '') : rawContent
    if (
      !content ||
      (role === 'assistant' && isSilentAssistantReply(content)) ||
      (role === 'user' && isInternalMemoryFlushPrompt(content))
    ) {
      return []
    }

    const idBase = typeof historyMessage.id === 'string' ? historyMessage.id : `${index}`
    const runId = typeof historyMessage.runId === 'string' ? historyMessage.runId : undefined

    return [
      {
        id: `history-${idBase}`,
        role,
        content,
        timeLabel: formatConversationTime(resolveMessageTimestamp(historyMessage)),
        status: role === 'user' ? 'sent' : undefined,
        runId,
        ...(role === 'user' && sanitizedUserMessage?.tags.length
          ? { tags: sanitizedUserMessage.tags }
          : {})
      }
    ]
  })
}
