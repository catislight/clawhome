import { useCallback, useEffect, useState } from 'react'

import type { OpenClawGatewayDebugLogEntry } from '@/features/logs/lib/openclaw-observability-presenters'
import {
  clearGatewayDebugLogs,
  getAppApiUnavailableMessage,
  hasAppApiMethod,
  listGatewayDebugLogs
} from '@/shared/api/app-api'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

const OPENCLAW_OBSERVABILITY_LOG_POLL_INTERVAL_MS = 2_000
const OPENCLAW_OBSERVABILITY_LOG_LIMIT = 400
const OPENCLAW_NOISY_EVENT_SOURCES = new Set(['tick', 'health'])

type UseOpenClawObservabilityLogsOptions = {
  instanceId: string | null
  enabled: boolean
  autoRefresh: boolean
}

type UseOpenClawObservabilityLogsResult = {
  logs: OpenClawGatewayDebugLogEntry[]
  loading: boolean
  refreshing: boolean
  clearing: boolean
  error: string | null
  lastUpdatedAt: string | null
  refresh: () => Promise<void>
  clearLogs: () => Promise<void>
}

function sortLogsByTimeDesc(
  logs: OpenClawGatewayDebugLogEntry[]
): OpenClawGatewayDebugLogEntry[] {
  return [...logs].sort((left, right) => {
    const leftTime = Date.parse(left.receivedAt)
    const rightTime = Date.parse(right.receivedAt)

    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
      return right.id.localeCompare(left.id)
    }

    return rightTime - leftTime
  })
}

function shouldExcludeOpenClawNoisyEvent(log: OpenClawGatewayDebugLogEntry): boolean {
  if (log.kind !== 'event') {
    return false
  }

  const normalizedSource = log.source.trim().toLowerCase()

  if (OPENCLAW_NOISY_EVENT_SOURCES.has(normalizedSource)) {
    return true
  }

  return normalizedSource.endsWith('.tick') || normalizedSource.endsWith('.health')
}

function filterOpenClawNoisyEvents(
  logs: OpenClawGatewayDebugLogEntry[]
): OpenClawGatewayDebugLogEntry[] {
  return logs.filter((log) => !shouldExcludeOpenClawNoisyEvent(log))
}

export function useOpenClawObservabilityLogs({
  instanceId,
  enabled,
  autoRefresh
}: UseOpenClawObservabilityLogsOptions): UseOpenClawObservabilityLogsResult {
  const [logs, setLogs] = useState<OpenClawGatewayDebugLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  const loadLogs = useCallback(
    async (options?: { silent?: boolean }): Promise<void> => {
      if (!enabled || !instanceId) {
        setLogs([])
        setLoading(false)
        setRefreshing(false)
        setClearing(false)
        setError(null)
        setLastUpdatedAt(null)
        return
      }

      if (!hasAppApiMethod('listGatewayDebugLogs')) {
        setError(getAppApiUnavailableMessage('listGatewayDebugLogs'))
        setLoading(false)
        setRefreshing(false)
        return
      }

      const silent = options?.silent === true

      if (silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      try {
        const response = await listGatewayDebugLogs({
          instanceId,
          limit: OPENCLAW_OBSERVABILITY_LOG_LIMIT
        })

        if (!response.success) {
          throw new Error(response.message || translateWithAppLanguage('logs.error.loadFailed'))
        }

        setLogs(sortLogsByTimeDesc(filterOpenClawNoisyEvents(response.logs)))
        setError(null)
        setLastUpdatedAt(new Date().toISOString())
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : translateWithAppLanguage('logs.error.loadFailed')
        )
      } finally {
        if (silent) {
          setRefreshing(false)
        } else {
          setLoading(false)
        }
      }
    },
    [enabled, instanceId]
  )

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  useEffect(() => {
    if (!enabled || !instanceId || !autoRefresh) {
      return
    }

    const timer = window.setInterval(() => {
      void loadLogs({
        silent: true
      })
    }, OPENCLAW_OBSERVABILITY_LOG_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [autoRefresh, enabled, instanceId, loadLogs])

  const clearLogs = useCallback(async (): Promise<void> => {
    if (!enabled || !instanceId) {
      return
    }

    if (!hasAppApiMethod('clearGatewayDebugLogs')) {
      setError(getAppApiUnavailableMessage('clearGatewayDebugLogs'))
      return
    }

    setClearing(true)

    try {
      const response = await clearGatewayDebugLogs({
        instanceId
      })

      if (!response.success) {
        throw new Error(response.message || translateWithAppLanguage('logs.error.clearFailed'))
      }

      setError(null)
      await loadLogs({
        silent: true
      })
    } catch (clearError) {
      setError(
        clearError instanceof Error ? clearError.message : translateWithAppLanguage('logs.error.clearFailed')
      )
    } finally {
      setClearing(false)
    }
  }, [enabled, instanceId, loadLogs])

  const refresh = useCallback(async (): Promise<void> => {
    await loadLogs()
  }, [loadLogs])

  return {
    logs,
    loading,
    refreshing,
    clearing,
    error,
    lastUpdatedAt,
    refresh,
    clearLogs
  }
}
