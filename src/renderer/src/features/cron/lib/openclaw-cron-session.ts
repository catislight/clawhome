import { OPENCLAW_CRON_SESSION_KEY_PREFIX } from '@/features/cron/lib/openclaw-cron-constants'

export function buildOpenClawCronSessionKey(jobId: string): string {
  return `${OPENCLAW_CRON_SESSION_KEY_PREFIX}${jobId}`
}
