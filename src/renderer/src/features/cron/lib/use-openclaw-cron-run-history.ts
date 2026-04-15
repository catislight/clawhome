import { useCallback, useEffect, useRef, useState } from 'react'

import {
  listOpenClawCronRuns,
  listOpenClawCronSessionMessages
} from '@/features/cron/lib/openclaw-cron-api'
import {
  OPENCLAW_CRON_RUN_HISTORY_MESSAGES_LIMIT,
  OPENCLAW_CRON_RUN_HISTORY_PAGE_SIZE
} from '@/features/cron/lib/openclaw-cron-constants'
import { toOpenClawCronErrorMessage } from '@/features/cron/lib/openclaw-cron-errors'
import { buildOpenClawCronSessionKey } from '@/features/cron/lib/openclaw-cron-session'
import type {
  OpenClawCronRunLogEntry,
  OpenClawCronRunsPage
} from '@/features/cron/lib/openclaw-cron-types'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

export type OpenClawCronRunHistoryItem = {
  id: string
  source: 'run-log' | 'legacy-session'
  entry?: OpenClawCronRunLogEntry
  outputs: string[]
  historyError?: string
}

type UseOpenClawCronRunHistoryResult = {
  items: OpenClawCronRunHistoryItem[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  refetch: () => Promise<void>
  loadMore: () => Promise<void>
}

type OpenClawCronHistoryMode = 'run-log' | 'legacy-session'

function normalizeOutputText(value: string | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function dedupeNonEmptyTexts(texts: string[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  for (const text of texts) {
    const normalized = normalizeOutputText(text)
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

function createRunHistoryItemId(entry: OpenClawCronRunLogEntry): string {
  return `${entry.jobId}:${entry.ts}:${entry.runAtMs ?? 'none'}:${entry.sessionKey ?? entry.sessionId ?? 'none'}`
}

function getFallbackOutputsFromRunLog(entry: OpenClawCronRunLogEntry): string[] {
  const summary = normalizeOutputText(entry.summary)
  if (summary) {
    return [summary]
  }

  const error = normalizeOutputText(entry.error)
  if (!error) {
    return []
  }

  return [translateWithAppLanguage('cron.error.runOutputPrefix', { error })]
}

async function resolveRunHistoryItem(params: {
  instanceId: string
  entry: OpenClawCronRunLogEntry
}): Promise<OpenClawCronRunHistoryItem> {
  const fallbackOutputs = getFallbackOutputsFromRunLog(params.entry)
  const sessionKey = normalizeOutputText(params.entry.sessionKey)

  if (!sessionKey) {
    return {
      id: createRunHistoryItemId(params.entry),
      source: 'run-log',
      entry: params.entry,
      outputs: fallbackOutputs
    }
  }

  try {
    const assistantMessages = await listOpenClawCronSessionMessages(
      params.instanceId,
      sessionKey,
      OPENCLAW_CRON_RUN_HISTORY_MESSAGES_LIMIT
    )
    const sessionOutputs = dedupeNonEmptyTexts(assistantMessages.map((message) => message.content))

    return {
      id: createRunHistoryItemId(params.entry),
      source: 'run-log',
      entry: params.entry,
      outputs: sessionOutputs.length > 0 ? sessionOutputs : fallbackOutputs
    }
  } catch (error) {
    return {
      id: createRunHistoryItemId(params.entry),
      source: 'run-log',
      entry: params.entry,
      outputs: fallbackOutputs,
      historyError: toOpenClawCronErrorMessage(
        error,
        translateWithAppLanguage('cron.error.readRunOutputFailed')
      )
    }
  }
}

async function loadLegacyHistoryItem(
  instanceId: string,
  jobId: string
): Promise<OpenClawCronRunHistoryItem[]> {
  const assistantMessages = await listOpenClawCronSessionMessages(
    instanceId,
    buildOpenClawCronSessionKey(jobId),
    OPENCLAW_CRON_RUN_HISTORY_MESSAGES_LIMIT
  )
  const outputs = dedupeNonEmptyTexts(assistantMessages.map((message) => message.content))
  if (outputs.length === 0) {
    return []
  }

  return [
    {
      id: `legacy:${jobId}`,
      source: 'legacy-session' as const,
      outputs
    }
  ]
}

function buildHasMore(page: OpenClawCronRunsPage): boolean {
  return Boolean(page.hasMore && typeof page.nextOffset === 'number')
}

export function useOpenClawCronRunHistory(
  instanceId: string | null,
  jobId: string | null,
  enabled: boolean,
  refreshToken?: string | number | boolean | null
): UseOpenClawCronRunHistoryResult {
  const [items, setItems] = useState<OpenClawCronRunHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const requestIdRef = useRef(0)
  const modeRef = useRef<OpenClawCronHistoryMode>('run-log')

  const resetState = useCallback(() => {
    requestIdRef.current += 1
    modeRef.current = 'run-log'
    setItems([])
    setLoading(false)
    setLoadingMore(false)
    setError(null)
    setHasMore(false)
    setNextOffset(null)
  }, [])

  const loadInitial = useCallback(async (): Promise<void> => {
    if (!instanceId || !jobId || !enabled) {
      resetState()
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    setLoadingMore(false)
    setError(null)
    setHasMore(false)
    setNextOffset(null)

    try {
      const page = await listOpenClawCronRuns(instanceId, {
        jobId,
        limit: OPENCLAW_CRON_RUN_HISTORY_PAGE_SIZE,
        offset: 0,
        sortDir: 'desc'
      })
      if (requestIdRef.current !== requestId) {
        return
      }

      if (page.entries.length === 0) {
        const legacyItems = await loadLegacyHistoryItem(instanceId, jobId)
        if (requestIdRef.current !== requestId) {
          return
        }

        modeRef.current = 'legacy-session'
        setItems(legacyItems)
        setHasMore(false)
        setNextOffset(null)
        return
      }

      const runItems = await Promise.all(
        page.entries.map((entry) =>
          resolveRunHistoryItem({
            instanceId,
            entry
          })
        )
      )
      if (requestIdRef.current !== requestId) {
        return
      }

      modeRef.current = 'run-log'
      setItems(runItems)
      setHasMore(buildHasMore(page))
      setNextOffset(page.nextOffset)
    } catch (loadError) {
      try {
        const legacyItems = await loadLegacyHistoryItem(instanceId, jobId)
        if (requestIdRef.current !== requestId) {
          return
        }

        modeRef.current = 'legacy-session'
        setItems(legacyItems)
        setHasMore(false)
        setNextOffset(null)
        setError(
          legacyItems.length > 0
            ? null
            : toOpenClawCronErrorMessage(
                loadError,
                translateWithAppLanguage('cron.error.loadRunHistoryFailed')
              )
        )
      } catch (fallbackError) {
        if (requestIdRef.current !== requestId) {
          return
        }

        setItems([])
        setHasMore(false)
        setNextOffset(null)
        setError(
          toOpenClawCronErrorMessage(
            fallbackError,
            translateWithAppLanguage('cron.error.loadRunHistoryFailed')
          )
        )
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [enabled, instanceId, jobId, resetState])

  const loadMore = useCallback(async (): Promise<void> => {
    if (!instanceId || !jobId || !enabled) {
      return
    }
    if (modeRef.current !== 'run-log') {
      return
    }
    if (loading || loadingMore || !hasMore || typeof nextOffset !== 'number') {
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoadingMore(true)
    setError(null)

    try {
      const page = await listOpenClawCronRuns(instanceId, {
        jobId,
        limit: OPENCLAW_CRON_RUN_HISTORY_PAGE_SIZE,
        offset: nextOffset,
        sortDir: 'desc'
      })
      if (requestIdRef.current !== requestId) {
        return
      }

      const runItems = await Promise.all(
        page.entries.map((entry) =>
          resolveRunHistoryItem({
            instanceId,
            entry
          })
        )
      )
      if (requestIdRef.current !== requestId) {
        return
      }

      setItems((current) => [...current, ...runItems])
      setHasMore(buildHasMore(page))
      setNextOffset(page.nextOffset)
    } catch (loadError) {
      if (requestIdRef.current !== requestId) {
        return
      }

      setError(
        toOpenClawCronErrorMessage(
          loadError,
          translateWithAppLanguage('cron.error.loadMoreRunHistoryFailed')
        )
      )
    } finally {
      if (requestIdRef.current === requestId) {
        setLoadingMore(false)
      }
    }
  }, [enabled, hasMore, instanceId, jobId, loading, loadingMore, nextOffset])

  useEffect(() => {
    void loadInitial()
  }, [loadInitial, refreshToken])

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    refetch: loadInitial,
    loadMore
  }
}
