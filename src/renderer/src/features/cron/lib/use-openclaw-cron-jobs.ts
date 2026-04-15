import { useCallback, useEffect, useRef, useState } from 'react'

import {
  createOpenClawCronJob,
  hasOpenClawCronJobOutput,
  getOpenClawCronSchedulerStatus,
  listOpenClawCronJobs,
  removeOpenClawCronJob,
  runOpenClawCronJob,
  updateOpenClawCronJob
} from '@/features/cron/lib/openclaw-cron-api'
import {
  OPENCLAW_CRON_INLINE_REFRESH_DELAY_MS,
  OPENCLAW_CRON_PENDING_OUTPUT_CHECK_ROUNDS,
  OPENCLAW_CRON_REFRESH_INTERVAL_MS,
  OPENCLAW_CRON_RUN_SYNC_MAX_MS,
  OPENCLAW_CRON_RUNNING_REFRESH_INTERVAL_MS
} from '@/features/cron/lib/openclaw-cron-constants'
import { toOpenClawCronErrorMessage } from '@/features/cron/lib/openclaw-cron-errors'
import { getOpenClawCronJobRunStatus } from '@/features/cron/lib/openclaw-cron-job-status'
import {
  areOpenClawCronOutputMapsEqual,
  areOpenClawCronSchedulerStatusesEqual,
  mergeOpenClawCronJobsWithReferenceReuse
} from '@/features/cron/lib/openclaw-cron-job-list-reconcile'
import type {
  OpenClawCronJob,
  OpenClawCronSchedulerStatus
} from '@/features/cron/lib/openclaw-cron-types'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

type LoadMode = 'initial' | 'refresh'
type RunSyncMonitor = {
  triggeredAt: number
  intervalId: number
  timeoutId: number
  completionChecks: number
}

const persistedRunSyncRegistry = new Map<string, number>()

function createRunSyncRegistryKey(instanceId: string, jobId: string): string {
  return `${instanceId}:${jobId}`
}

export function useOpenClawCronJobs(
  instanceId: string | null,
  enabled: boolean
): {
  jobs: OpenClawCronJob[]
  schedulerStatus: OpenClawCronSchedulerStatus | null
  loading: boolean
  error: string | null
  mutateKey: string | null
  lastSuccessfulLoadAt: number | null
  syncingRunJobIds: string[]
  jobHasRecentOutputById: Record<string, boolean>
  refetch: () => Promise<boolean>
  createJob: (payload: Record<string, unknown>) => Promise<boolean>
  updateJob: (jobId: string, patch: Record<string, unknown>) => Promise<boolean>
  runJob: (jobId: string) => Promise<boolean>
  removeJob: (jobId: string) => Promise<boolean>
} {
  const [jobs, setJobs] = useState<OpenClawCronJob[]>([])
  const [schedulerStatus, setSchedulerStatus] = useState<OpenClawCronSchedulerStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mutateKey, setMutateKey] = useState<string | null>(null)
  const [lastSuccessfulLoadAt, setLastSuccessfulLoadAt] = useState<number | null>(null)
  const [syncingRunJobIds, setSyncingRunJobIds] = useState<string[]>([])
  const [jobHasRecentOutputById, setJobHasRecentOutputById] = useState<Record<string, boolean>>({})
  const requestIdRef = useRef(0)
  const runSyncMonitorsRef = useRef<Record<string, RunSyncMonitor>>({})

  const clearRunFollowUpSync = useCallback(
    (jobId: string): void => {
      if (instanceId) {
        persistedRunSyncRegistry.delete(createRunSyncRegistryKey(instanceId, jobId))
      }

      const monitor = runSyncMonitorsRef.current[jobId]
      if (!monitor) {
        return
      }

      window.clearInterval(monitor.intervalId)
      window.clearTimeout(monitor.timeoutId)
      delete runSyncMonitorsRef.current[jobId]
      setSyncingRunJobIds((current) => current.filter((item) => item !== jobId))
    },
    [instanceId]
  )

  const reconcileRunSyncState = useCallback(
    (nextJobs: OpenClawCronJob[], nextOutputById: Record<string, boolean>): void => {
      for (const [jobId, monitor] of Object.entries(runSyncMonitorsRef.current)) {
        const job = nextJobs.find((entry) => entry.id === jobId)
        if (!job) {
          clearRunFollowUpSync(jobId)
          continue
        }

        if (typeof job.state.runningAtMs === 'number') {
          monitor.completionChecks = 0
          continue
        }

        if (
          typeof job.state.lastRunAtMs !== 'number' ||
          job.state.lastRunAtMs < monitor.triggeredAt
        ) {
          continue
        }

        const hasRecentOutput = nextOutputById[jobId] === true
        const runStatus = getOpenClawCronJobRunStatus(job)

        if (
          job.sessionTarget !== 'isolated' ||
          hasRecentOutput ||
          runStatus === 'error' ||
          runStatus === 'skipped'
        ) {
          clearRunFollowUpSync(jobId)
          continue
        }

        monitor.completionChecks += 1
        if (monitor.completionChecks >= OPENCLAW_CRON_PENDING_OUTPUT_CHECK_ROUNDS) {
          clearRunFollowUpSync(jobId)
        }
      }
    },
    [clearRunFollowUpSync]
  )

  const clearAllRunSyncMonitors = useCallback((): void => {
    for (const monitor of Object.values(runSyncMonitorsRef.current)) {
      window.clearInterval(monitor.intervalId)
      window.clearTimeout(monitor.timeoutId)
    }
    runSyncMonitorsRef.current = {}
  }, [])

  const load = useCallback(
    async (mode: LoadMode): Promise<boolean> => {
      if (!instanceId || !enabled) {
        clearAllRunSyncMonitors()
        setJobs([])
        setSchedulerStatus(null)
        setError(null)
        setLoading(false)
        setLastSuccessfulLoadAt(null)
        setSyncingRunJobIds([])
        setJobHasRecentOutputById({})
        return false
      }

      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId

      if (mode === 'initial') {
        setLoading(true)
      }

      try {
        const [nextStatus, nextJobs] = await Promise.all([
          getOpenClawCronSchedulerStatus(instanceId),
          listOpenClawCronJobs(instanceId)
        ])
        const nextOutputEntries = await Promise.all(
          nextJobs.map(async (job) => {
            if (job.sessionTarget !== 'isolated' || typeof job.state.lastRunAtMs !== 'number') {
              return [job.id, false] as const
            }

            try {
              const hasRecentOutput = await hasOpenClawCronJobOutput(instanceId, job.id)
              return [job.id, hasRecentOutput] as const
            } catch {
              return [job.id, undefined] as const
            }
          })
        )

        if (requestIdRef.current !== requestId) {
          return false
        }

        setSchedulerStatus((current) =>
          areOpenClawCronSchedulerStatusesEqual(current, nextStatus) ? current : nextStatus
        )
        setJobs((current) => mergeOpenClawCronJobsWithReferenceReuse(current, nextJobs))
        const nextOutputById = Object.fromEntries(
          nextOutputEntries.filter(
            (entry): entry is [string, boolean] => typeof entry[1] === 'boolean'
          )
        )
        setJobHasRecentOutputById((current) =>
          areOpenClawCronOutputMapsEqual(current, nextOutputById) ? current : nextOutputById
        )
        setError(null)
        if (mode === 'initial') {
          setLastSuccessfulLoadAt(Date.now())
        }
        reconcileRunSyncState(nextJobs, nextOutputById)
        return true
      } catch (loadError) {
        if (requestIdRef.current !== requestId) {
          return false
        }

        setError(toOpenClawCronErrorMessage(loadError, translateWithAppLanguage('cron.error.loadJobsFailed')))
        return false
      } finally {
        if (mode === 'initial') {
          setLoading(false)
        }
      }
    },
    [clearAllRunSyncMonitors, enabled, instanceId, reconcileRunSyncState]
  )

  useEffect(() => {
    if (!instanceId || !enabled) {
      clearAllRunSyncMonitors()
      setJobs([])
      setSchedulerStatus(null)
      setError(null)
      setLoading(false)
      setLastSuccessfulLoadAt(null)
      setSyncingRunJobIds([])
      setJobHasRecentOutputById({})
      return
    }

    void load('initial')
  }, [clearAllRunSyncMonitors, enabled, instanceId, load])

  useEffect(() => {
    if (!instanceId || !enabled) {
      return
    }

    const hasLocalRunSync = syncingRunJobIds.length > 0
    const refreshIntervalMs = hasLocalRunSync
      ? OPENCLAW_CRON_RUNNING_REFRESH_INTERVAL_MS
      : OPENCLAW_CRON_REFRESH_INTERVAL_MS

    const timer = window.setInterval(() => {
      void load('refresh')
    }, refreshIntervalMs)

    const handleWindowFocus = (): void => {
      void load('refresh')
    }

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        void load('refresh')
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, instanceId, load, syncingRunJobIds.length])

  useEffect(() => {
    if (!instanceId || !enabled) {
      return
    }

    const pendingEntries = Array.from(persistedRunSyncRegistry.entries())
      .filter(([key]) => key.startsWith(`${instanceId}:`))
      .map(([key, triggeredAt]) => ({
        jobId: key.slice(instanceId.length + 1),
        triggeredAt
      }))

    if (pendingEntries.length === 0) {
      return
    }

    setSyncingRunJobIds((current) => {
      const next = new Set(current)
      pendingEntries.forEach((entry) => next.add(entry.jobId))
      return [...next]
    })

    for (const entry of pendingEntries) {
      if (runSyncMonitorsRef.current[entry.jobId]) {
        continue
      }

      const elapsedMs = Date.now() - entry.triggeredAt
      const remainingMs = Math.max(0, OPENCLAW_CRON_RUN_SYNC_MAX_MS - elapsedMs)

      if (remainingMs <= 0) {
        persistedRunSyncRegistry.delete(createRunSyncRegistryKey(instanceId, entry.jobId))
        continue
      }

      const intervalId = window.setInterval(() => {
        void load('refresh')
      }, OPENCLAW_CRON_RUNNING_REFRESH_INTERVAL_MS)
      const timeoutId = window.setTimeout(() => {
        clearRunFollowUpSync(entry.jobId)
      }, remainingMs)

      runSyncMonitorsRef.current[entry.jobId] = {
        triggeredAt: entry.triggeredAt,
        intervalId,
        timeoutId,
        completionChecks: 0
      }
    }

    void load('refresh')
  }, [clearRunFollowUpSync, enabled, instanceId, load])

  useEffect(() => {
    return () => {
      clearAllRunSyncMonitors()
    }
  }, [clearAllRunSyncMonitors])

  const scheduleRunFollowUpSync = useCallback(
    (jobId: string, triggeredAtOverride?: number): void => {
      if (!instanceId) {
        return
      }

      clearRunFollowUpSync(jobId)
      setSyncingRunJobIds((current) => (current.includes(jobId) ? current : [...current, jobId]))

      const triggeredAt =
        typeof triggeredAtOverride === 'number' && Number.isFinite(triggeredAtOverride)
          ? triggeredAtOverride
          : Date.now()
      persistedRunSyncRegistry.set(createRunSyncRegistryKey(instanceId, jobId), triggeredAt)
      const intervalId = window.setInterval(() => {
        void load('refresh')
      }, OPENCLAW_CRON_RUNNING_REFRESH_INTERVAL_MS)
      const timeoutId = window.setTimeout(() => {
        clearRunFollowUpSync(jobId)
      }, OPENCLAW_CRON_RUN_SYNC_MAX_MS)

      runSyncMonitorsRef.current[jobId] = {
        triggeredAt,
        intervalId,
        timeoutId,
        completionChecks: 0
      }

      window.setTimeout(() => {
        void load('refresh')
      }, OPENCLAW_CRON_INLINE_REFRESH_DELAY_MS)
    },
    [clearRunFollowUpSync, instanceId, load]
  )

  const refetch = useCallback(async (): Promise<boolean> => {
    setError(null)
    return await load('refresh')
  }, [load])

  const runMutation = useCallback(
    async (key: string, action: () => Promise<void>): Promise<boolean> => {
      setMutateKey(key)
      setError(null)

      try {
        await action()
        return await load('refresh')
      } catch (mutationError) {
        setError(
          toOpenClawCronErrorMessage(
            mutationError,
            translateWithAppLanguage('cron.error.jobMutationFailed')
          )
        )
        return false
      } finally {
        setMutateKey((current) => (current === key ? null : current))
      }
    },
    [load]
  )

  const createJob = useCallback(
    async (payload: Record<string, unknown>): Promise<boolean> => {
      if (!instanceId) {
        throw new Error(translateWithAppLanguage('cron.error.notSelectedInstance'))
      }

      return await runMutation('create', async () => {
        await createOpenClawCronJob(instanceId, payload)
      })
    },
    [instanceId, runMutation]
  )

  const updateJob = useCallback(
    async (jobId: string, patch: Record<string, unknown>): Promise<boolean> => {
      if (!instanceId) {
        throw new Error(translateWithAppLanguage('cron.error.notSelectedInstance'))
      }

      return await runMutation(`update:${jobId}`, async () => {
        await updateOpenClawCronJob(instanceId, jobId, patch)
      })
    },
    [instanceId, runMutation]
  )

  const runJob = useCallback(
    async (jobId: string): Promise<boolean> => {
      if (!instanceId) {
        throw new Error(translateWithAppLanguage('cron.error.notSelectedInstance'))
      }

      const runTriggeredAt = Date.now()
      const success = await runMutation(`run:${jobId}`, async () => {
        await runOpenClawCronJob(instanceId, jobId)
      })

      if (success) {
        scheduleRunFollowUpSync(jobId, runTriggeredAt)
      }

      return success
    },
    [instanceId, runMutation, scheduleRunFollowUpSync]
  )

  const removeJob = useCallback(
    async (jobId: string): Promise<boolean> => {
      if (!instanceId) {
        throw new Error(translateWithAppLanguage('cron.error.notSelectedInstance'))
      }

      clearRunFollowUpSync(jobId)

      return await runMutation(`remove:${jobId}`, async () => {
        await removeOpenClawCronJob(instanceId, jobId)
      })
    },
    [clearRunFollowUpSync, instanceId, runMutation]
  )

  return {
    jobs,
    schedulerStatus,
    loading,
    error,
    mutateKey,
    lastSuccessfulLoadAt,
    syncingRunJobIds,
    jobHasRecentOutputById,
    refetch,
    createJob,
    updateJob,
    runJob,
    removeJob
  }
}
