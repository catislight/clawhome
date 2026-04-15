import type {
  OpenClawCronJob,
  OpenClawCronSchedulerStatus
} from '@/features/cron/lib/openclaw-cron-types'

function areCronSchedulesEqual(
  left: OpenClawCronJob['schedule'],
  right: OpenClawCronJob['schedule']
): boolean {
  if (left.kind !== right.kind) {
    return false
  }

  if (left.kind === 'at' && right.kind === 'at') {
    return left.at === right.at
  }

  if (left.kind === 'every' && right.kind === 'every') {
    return left.everyMs === right.everyMs && left.anchorMs === right.anchorMs
  }

  if (left.kind === 'cron' && right.kind === 'cron') {
    return left.expr === right.expr && left.tz === right.tz && left.staggerMs === right.staggerMs
  }

  return false
}

function areCronPayloadsEqual(
  left: OpenClawCronJob['payload'],
  right: OpenClawCronJob['payload']
): boolean {
  if (left.kind !== right.kind) {
    return false
  }

  if (left.kind === 'systemEvent' && right.kind === 'systemEvent') {
    return left.text === right.text
  }

  if (left.kind === 'agentTurn' && right.kind === 'agentTurn') {
    return (
      left.message === right.message &&
      left.model === right.model &&
      JSON.stringify(left.fallbacks ?? []) === JSON.stringify(right.fallbacks ?? []) &&
      left.thinking === right.thinking &&
      left.timeoutSeconds === right.timeoutSeconds &&
      left.allowUnsafeExternalContent === right.allowUnsafeExternalContent &&
      left.lightContext === right.lightContext &&
      left.deliver === right.deliver &&
      left.channel === right.channel &&
      left.to === right.to &&
      left.bestEffortDeliver === right.bestEffortDeliver
    )
  }

  return false
}

function areCronDeliveriesEqual(
  left: OpenClawCronJob['delivery'],
  right: OpenClawCronJob['delivery']
): boolean {
  if (!left && !right) {
    return true
  }

  if (!left || !right) {
    return false
  }

  return (
    left.mode === right.mode &&
    left.channel === right.channel &&
    left.to === right.to &&
    left.accountId === right.accountId &&
    left.bestEffort === right.bestEffort
  )
}

function areCronStatesEqual(
  left: OpenClawCronJob['state'],
  right: OpenClawCronJob['state']
): boolean {
  return (
    left.nextRunAtMs === right.nextRunAtMs &&
    left.runningAtMs === right.runningAtMs &&
    left.lastRunAtMs === right.lastRunAtMs &&
    left.lastRunStatus === right.lastRunStatus &&
    left.lastStatus === right.lastStatus &&
    left.lastError === right.lastError &&
    left.lastDurationMs === right.lastDurationMs &&
    left.consecutiveErrors === right.consecutiveErrors &&
    left.lastDelivered === right.lastDelivered &&
    left.lastDeliveryStatus === right.lastDeliveryStatus &&
    left.lastDeliveryError === right.lastDeliveryError
  )
}

function areCronJobsEqual(left: OpenClawCronJob, right: OpenClawCronJob): boolean {
  return (
    left.id === right.id &&
    left.agentId === right.agentId &&
    left.sessionKey === right.sessionKey &&
    left.name === right.name &&
    left.description === right.description &&
    left.enabled === right.enabled &&
    left.deleteAfterRun === right.deleteAfterRun &&
    left.createdAtMs === right.createdAtMs &&
    left.updatedAtMs === right.updatedAtMs &&
    areCronSchedulesEqual(left.schedule, right.schedule) &&
    left.sessionTarget === right.sessionTarget &&
    left.wakeMode === right.wakeMode &&
    areCronPayloadsEqual(left.payload, right.payload) &&
    areCronDeliveriesEqual(left.delivery, right.delivery) &&
    areCronStatesEqual(left.state, right.state)
  )
}

function alignCronJobsOrder(
  previousJobs: OpenClawCronJob[],
  incomingJobs: OpenClawCronJob[]
): OpenClawCronJob[] {
  if (previousJobs.length === 0 || incomingJobs.length === 0) {
    return incomingJobs
  }

  const incomingById = new Map(incomingJobs.map((job) => [job.id, job] as const))
  const orderedJobs: OpenClawCronJob[] = []

  for (const previousJob of previousJobs) {
    const matched = incomingById.get(previousJob.id)
    if (!matched) {
      continue
    }

    orderedJobs.push(matched)
    incomingById.delete(previousJob.id)
  }

  for (const incomingJob of incomingJobs) {
    if (!incomingById.has(incomingJob.id)) {
      continue
    }

    orderedJobs.push(incomingJob)
    incomingById.delete(incomingJob.id)
  }

  return orderedJobs.length === incomingJobs.length ? orderedJobs : incomingJobs
}

export function mergeOpenClawCronJobsWithReferenceReuse(
  previousJobs: OpenClawCronJob[],
  incomingJobs: OpenClawCronJob[]
): OpenClawCronJob[] {
  const orderedIncomingJobs = alignCronJobsOrder(previousJobs, incomingJobs)
  if (previousJobs.length === 0) {
    return orderedIncomingJobs
  }

  const previousById = new Map(previousJobs.map((job) => [job.id, job] as const))
  const mergedJobs = orderedIncomingJobs.map((incomingJob) => {
    const previousJob = previousById.get(incomingJob.id)
    if (previousJob && areCronJobsEqual(previousJob, incomingJob)) {
      return previousJob
    }

    return incomingJob
  })

  if (
    previousJobs.length === mergedJobs.length &&
    previousJobs.every((job, index) => job === mergedJobs[index])
  ) {
    return previousJobs
  }

  return mergedJobs
}

export function areOpenClawCronSchedulerStatusesEqual(
  left: OpenClawCronSchedulerStatus | null,
  right: OpenClawCronSchedulerStatus | null
): boolean {
  if (left === right) {
    return true
  }

  if (!left || !right) {
    return false
  }

  return (
    left.enabled === right.enabled &&
    left.storePath === right.storePath &&
    left.jobs === right.jobs &&
    left.nextWakeAtMs === right.nextWakeAtMs
  )
}

export function areOpenClawCronOutputMapsEqual(
  left: Record<string, boolean>,
  right: Record<string, boolean>
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  for (const key of rightKeys) {
    if (left[key] !== right[key]) {
      return false
    }
  }

  return true
}
