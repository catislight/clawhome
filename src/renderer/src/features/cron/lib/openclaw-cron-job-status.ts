import type {
  OpenClawCronJob,
  OpenClawCronRunStatus
} from '@/features/cron/lib/openclaw-cron-types'

export function getOpenClawCronJobRunStatus(job: OpenClawCronJob): OpenClawCronRunStatus | null {
  return job.state.lastRunStatus ?? job.state.lastStatus ?? null
}
