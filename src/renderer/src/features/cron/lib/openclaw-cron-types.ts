export type OpenClawCronSchedule =
  | {
      kind: 'at'
      at: string
    }
  | {
      kind: 'every'
      everyMs: number
      anchorMs?: number
    }
  | {
      kind: 'cron'
      expr: string
      tz?: string
      staggerMs?: number
    }

export type OpenClawCronSessionTarget = 'main' | 'isolated'
export type OpenClawCronWakeMode = 'now' | 'next-heartbeat'
export type OpenClawCronDeliveryMode = 'none' | 'announce' | 'webhook'
export type OpenClawCronRunStatus = 'ok' | 'error' | 'skipped'
export type OpenClawCronDeliveryStatus = 'delivered' | 'not-delivered' | 'unknown' | 'not-requested'

export type OpenClawCronPayload =
  | {
      kind: 'systemEvent'
      text: string
    }
  | {
      kind: 'agentTurn'
      message: string
      model?: string
      fallbacks?: string[]
      thinking?: string
      timeoutSeconds?: number
      allowUnsafeExternalContent?: boolean
      lightContext?: boolean
      deliver?: boolean
      channel?: string
      to?: string
      bestEffortDeliver?: boolean
    }

export type OpenClawCronDelivery = {
  mode: OpenClawCronDeliveryMode
  channel?: string
  to?: string
  accountId?: string
  bestEffort?: boolean
}

export type OpenClawCronJobState = {
  nextRunAtMs?: number
  runningAtMs?: number
  lastRunAtMs?: number
  lastRunStatus?: OpenClawCronRunStatus
  lastStatus?: OpenClawCronRunStatus
  lastError?: string
  lastDurationMs?: number
  consecutiveErrors?: number
  lastDelivered?: boolean
  lastDeliveryStatus?: OpenClawCronDeliveryStatus
  lastDeliveryError?: string
}

export type OpenClawCronJob = {
  id: string
  agentId?: string
  sessionKey?: string
  name: string
  description?: string
  enabled: boolean
  deleteAfterRun?: boolean
  createdAtMs: number
  updatedAtMs: number
  schedule: OpenClawCronSchedule
  sessionTarget: OpenClawCronSessionTarget
  wakeMode: OpenClawCronWakeMode
  payload: OpenClawCronPayload
  delivery?: OpenClawCronDelivery
  state: OpenClawCronJobState
}

export type OpenClawCronSchedulerStatus = {
  enabled: boolean
  storePath?: string
  jobs: number
  nextWakeAtMs?: number
}

export type OpenClawCronRunLogSortDir = 'asc' | 'desc'

export type OpenClawCronRunLogUsage = {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  cache_read_tokens?: number
  cache_write_tokens?: number
}

export type OpenClawCronRunLogEntry = {
  ts: number
  jobId: string
  action: 'finished'
  status?: OpenClawCronRunStatus
  error?: string
  summary?: string
  delivered?: boolean
  deliveryStatus?: OpenClawCronDeliveryStatus
  deliveryError?: string
  sessionId?: string
  sessionKey?: string
  runAtMs?: number
  durationMs?: number
  nextRunAtMs?: number
  model?: string
  provider?: string
  usage?: OpenClawCronRunLogUsage
  jobName?: string
}

export type OpenClawCronRunsPage = {
  entries: OpenClawCronRunLogEntry[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
  nextOffset: number | null
}

export type OpenClawCronVisualStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped'

export type OpenClawCronFormValues = {
  name: string
  description: string
  enabled: boolean
  sessionTarget: OpenClawCronSessionTarget
  wakeMode: OpenClawCronWakeMode
  scheduleKind: OpenClawCronSchedule['kind']
  atDateTime: string
  everyInterval: string
  cronExpr: string
  cronTz: string
  deleteAfterRun: boolean
  systemEventText: string
  agentMessage: string
  deliveryMode: Extract<OpenClawCronDeliveryMode, 'announce' | 'none'>
  deliveryChannel: string
}
