import type { SelectOption } from '@/shared/ui/select'
import {
  getCurrentAppLanguage,
  translateWithAppLanguage,
  type AppI18nKey
} from '@/shared/i18n/app-i18n'

export type OpenClawGatewayDebugLogEntry = Awaited<
  ReturnType<Window['api']['listGatewayDebugLogs']>
>['logs'][number]

export type OpenClawLogLevelFilter = 'all' | OpenClawGatewayDebugLogEntry['level']
export type OpenClawLogKindFilter = 'all' | OpenClawGatewayDebugLogEntry['kind']

export function buildOpenClawLogLevelFilterOptions(): SelectOption[] {
  return [
    {
      value: 'all',
      label: translateWithAppLanguage('logs.filter.level.all')
    },
    {
      value: 'error',
      label: translateWithAppLanguage('logs.filter.level.error')
    },
    {
      value: 'warn',
      label: translateWithAppLanguage('logs.filter.level.warn')
    },
    {
      value: 'info',
      label: translateWithAppLanguage('logs.filter.level.info')
    }
  ]
}

export function buildOpenClawLogKindFilterOptions(): SelectOption[] {
  return [
    {
      value: 'all',
      label: translateWithAppLanguage('logs.filter.kind.all')
    },
    {
      value: 'event',
      label: translateWithAppLanguage('logs.filter.kind.event')
    },
    {
      value: 'request',
      label: translateWithAppLanguage('logs.filter.kind.request')
    },
    {
      value: 'response',
      label: translateWithAppLanguage('logs.filter.kind.response')
    },
    {
      value: 'system',
      label: translateWithAppLanguage('logs.filter.kind.system')
    }
  ]
}

function normalizeSearchKeyword(value: string): string {
  return value.trim().toLowerCase()
}

export function resolveOpenClawLogKindLabel(kind: OpenClawGatewayDebugLogEntry['kind']): string {
  if (kind === 'event') {
    return translateWithAppLanguage('logs.kind.event')
  }

  if (kind === 'request') {
    return translateWithAppLanguage('logs.kind.request')
  }

  if (kind === 'response') {
    return translateWithAppLanguage('logs.kind.response')
  }

  return translateWithAppLanguage('logs.kind.system')
}

export function resolveOpenClawLogLevelLabel(level: OpenClawGatewayDebugLogEntry['level']): string {
  if (level === 'error') {
    return translateWithAppLanguage('logs.level.error')
  }

  if (level === 'warn') {
    return translateWithAppLanguage('logs.level.warn')
  }

  return translateWithAppLanguage('logs.level.info')
}

export function resolveOpenClawLogLevelDotClassName(
  level: OpenClawGatewayDebugLogEntry['level']
): string {
  if (level === 'error') {
    return 'bg-rose-500'
  }

  if (level === 'warn') {
    return 'bg-amber-500'
  }

  return 'bg-emerald-500'
}

export function resolveOpenClawLogLevelTagClassName(
  level: OpenClawGatewayDebugLogEntry['level']
): string {
  if (level === 'error') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }

  if (level === 'warn') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }

  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

export function formatOpenClawLogTimestamp(timestamp: string): string {
  const parsed = Date.parse(timestamp)
  if (Number.isNaN(parsed)) {
    return '--'
  }

  const date = new Date(parsed)
  const language = getCurrentAppLanguage()
  const locale = language === 'en-US' ? 'en-US' : 'zh-CN'
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date)
}

type OpenClawLogMessageResolver = {
  pattern: RegExp
  key: AppI18nKey
  resolveParams: (match: RegExpMatchArray) => Record<string, string | number>
}

const LOG_MESSAGE_RESOLVERS: OpenClawLogMessageResolver[] = [
  {
    pattern: /^请求成功[:：]\s*(.+)$/u,
    key: 'logs.message.requestSuccess',
    resolveParams: (match) => ({ method: match[1]?.trim() ?? '-' })
  },
  {
    pattern: /^请求失败[:：]\s*(.+?)，当前实例未连接 Gateway。?$/u,
    key: 'logs.message.requestFailedDisconnected',
    resolveParams: (match) => ({ method: match[1]?.trim() ?? '-' })
  },
  {
    pattern: /^请求失败[:：]\s*(.+)$/u,
    key: 'logs.message.requestFailed',
    resolveParams: (match) => ({ method: match[1]?.trim() ?? '-' })
  },
  {
    pattern: /^事件拉取成功$/u,
    key: 'logs.message.eventsPullSuccess',
    resolveParams: () => ({})
  },
  {
    pattern: /^事件拉取失败$/u,
    key: 'logs.message.eventsPullFailed',
    resolveParams: () => ({})
  },
  {
    pattern: /^日志读取成功$/u,
    key: 'logs.message.readSuccess',
    resolveParams: () => ({})
  },
  {
    pattern: /^日志读取失败$/u,
    key: 'logs.message.readFailed',
    resolveParams: () => ({})
  },
  {
    pattern: /^日志清空成功[（(]\s*(\d+)\s*条[）)]$/u,
    key: 'logs.message.clearSuccessWithCount',
    resolveParams: (match) => ({ count: Number(match[1]) || 0 })
  },
  {
    pattern: /^日志清空成功$/u,
    key: 'logs.message.clearSuccess',
    resolveParams: () => ({})
  },
  {
    pattern: /^日志清空失败$/u,
    key: 'logs.message.clearFailed',
    resolveParams: () => ({})
  }
]

export function resolveOpenClawLogMessage(message: string): string {
  const trimmedMessage = message.trim()

  if (!trimmedMessage) {
    return message
  }

  for (const resolver of LOG_MESSAGE_RESOLVERS) {
    const match = trimmedMessage.match(resolver.pattern)
    if (!match) {
      continue
    }

    return translateWithAppLanguage(resolver.key, resolver.resolveParams(match))
  }

  return message
}

export function buildOpenClawLogSearchableText(log: OpenClawGatewayDebugLogEntry): string {
  return [
    log.kind,
    log.level,
    log.source,
    resolveOpenClawLogMessage(log.message),
    log.requestId ?? '',
    log.payloadText ?? ''
  ]
    .join(' ')
    .toLowerCase()
}

export function filterOpenClawLogs(
  logs: OpenClawGatewayDebugLogEntry[],
  filters: {
    keyword: string
    level: OpenClawLogLevelFilter
    kind: OpenClawLogKindFilter
  }
): OpenClawGatewayDebugLogEntry[] {
  const normalizedKeyword = normalizeSearchKeyword(filters.keyword)

  return logs.filter((log) => {
    if (filters.level !== 'all' && log.level !== filters.level) {
      return false
    }

    if (filters.kind !== 'all' && log.kind !== filters.kind) {
      return false
    }

    if (!normalizedKeyword) {
      return true
    }

    return buildOpenClawLogSearchableText(log).includes(normalizedKeyword)
  })
}

export function summarizeOpenClawLogStats(logs: OpenClawGatewayDebugLogEntry[]): {
  total: number
  error: number
  warn: number
  info: number
} {
  let error = 0
  let warn = 0
  let info = 0

  for (const log of logs) {
    if (log.level === 'error') {
      error += 1
      continue
    }

    if (log.level === 'warn') {
      warn += 1
      continue
    }

    info += 1
  }

  return {
    total: logs.length,
    error,
    warn,
    info
  }
}

export function buildOpenClawLogCopyText(log: OpenClawGatewayDebugLogEntry): string {
  const resolvedMessage = resolveOpenClawLogMessage(log.message)

  return [
    translateWithAppLanguage('logs.copyText.time', { value: log.receivedAt }),
    translateWithAppLanguage('logs.copyText.level', { value: log.level }),
    translateWithAppLanguage('logs.copyText.kind', { value: log.kind }),
    translateWithAppLanguage('logs.copyText.source', { value: log.source }),
    translateWithAppLanguage('logs.copyText.requestId', {
      value: log.requestId ?? '-'
    }),
    translateWithAppLanguage('logs.copyText.message', { value: resolvedMessage }),
    translateWithAppLanguage('logs.copyText.payload'),
    log.payloadText ?? '-'
  ].join('\n')
}
