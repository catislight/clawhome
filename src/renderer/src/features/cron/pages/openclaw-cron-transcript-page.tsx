import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import OpenClawCronRunHistory from '@/features/cron/components/openclaw-cron-run-history'
import { buildOpenClawCronSessionKey } from '@/features/cron/lib/openclaw-cron-session'
import { Button } from '@/shared/ui/button'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import AppShellContentArea from '@/shared/layout/app-shell-content-area'
import { useOpenClawConnectionActions } from '@/features/instances/lib/use-openclaw-connection-actions'
import { useAppStore } from '@/features/instances/store/use-app-store'

type CronTranscriptLocationState = {
  jobName?: string
}

function OpenClawCronTranscriptPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { t } = useAppI18n()
  const location = useLocation()
  const locationState = (location.state as CronTranscriptLocationState | null) ?? null
  const [searchParams] = useSearchParams()
  const instances = useAppStore((state) => state.instances)
  const { connectInstance } = useOpenClawConnectionActions()
  const instanceId = searchParams.get('instanceId') ?? ''
  const jobId = searchParams.get('jobId') ?? ''
  const instance = useMemo(
    () => instances.find((item) => item.id === instanceId) ?? null,
    [instanceId, instances]
  )
  const jobName =
    locationState?.jobName?.trim() ||
    t('cron.transcript.defaultJobName', {
      jobId: jobId || t('cron.transcript.defaultJobOutput')
    })
  const sessionKey = jobId ? buildOpenClawCronSessionKey(jobId) : null

  return (
    <AppShellContentArea
      contentScrollable={false}
      disableInnerPadding
      contentClassName="min-h-0 flex-1"
      innerClassName="flex h-full min-h-0 flex-col gap-0"
      header={
        <div className="flex w-full min-w-0 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {jobName}
            </h1>
            {instance ? (
              <span className="truncate text-sm text-muted-foreground">{instance.name}</span>
            ) : null}
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-[0.75rem] px-3.5 text-sm"
            onClick={() => navigate(instanceId ? `/cron?instanceId=${instanceId}` : '/cron')}
          >
            <ArrowLeft className="size-4" />
            {t('cron.transcript.backToList')}
          </Button>
        </div>
      }
    >
      {!instance ? (
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
          <h2 className="text-[1.45rem] font-semibold tracking-tight text-foreground">
            {t('cron.transcript.instanceMissing.title')}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            {t('cron.transcript.instanceMissing.description')}
          </p>
        </section>
      ) : !jobId ? (
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
          <h2 className="text-[1.45rem] font-semibold tracking-tight text-foreground">
            {t('cron.transcript.missingJobId.title')}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            {t('cron.transcript.missingJobId.description')}
          </p>
        </section>
      ) : instance.connectionConfig === null ? (
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
          <h2 className="text-[1.45rem] font-semibold tracking-tight text-foreground">
            {t('cron.transcript.noConnectionConfig.title')}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            {t('cron.transcript.noConnectionConfig.description')}
          </p>
        </section>
      ) : instance.connectionState !== 'connected' ? (
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
          <h2 className="text-[1.45rem] font-semibold tracking-tight text-foreground">
            {t('cron.transcript.disconnected.title')}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            {t('cron.transcript.disconnected.description')}
          </p>
          <Button
            type="button"
            className="mt-6 h-11 min-w-40 rounded-[0.85rem] px-6"
            onClick={() => {
              void connectInstance(instance)
            }}
          >
            {t('cron.transcript.connectInstance')}
          </Button>
        </section>
      ) : (
        <section className="flex min-h-0 flex-1 flex-col">
          <OpenClawCronRunHistory
            instanceId={instance.id}
            jobId={jobId}
            enabled={Boolean(sessionKey)}
            className="min-h-0 flex-1"
            innerClassName="h-full"
            emptyTitle={t('cron.transcript.runHistory.emptyTitle')}
            emptyDescription={t('cron.transcript.runHistory.emptyDescription')}
          />
        </section>
      )}
    </AppShellContentArea>
  )
}

export default OpenClawCronTranscriptPage
