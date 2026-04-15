import { AlertTriangle, Loader2, Play, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import OpenClawCronRunHistory from '@/features/cron/components/openclaw-cron-run-history'
import OpenClawCronJobEditorDialog from '@/features/cron/components/openclaw-cron-job-editor-dialog'
import OpenClawCronJobsSidebar from '@/features/cron/components/openclaw-cron-jobs-sidebar'
import {
  buildCreateOpenClawCronPayload,
  buildUpdateOpenClawCronPatch
} from '@/features/cron/lib/openclaw-cron-form'
import type {
  OpenClawCronFormValues,
  OpenClawCronJob
} from '@/features/cron/lib/openclaw-cron-types'
import { buildOpenClawCronSessionKey } from '@/features/cron/lib/openclaw-cron-session'
import { useCronPageInstanceSelection } from '@/features/cron/lib/use-cron-page-instance-selection'
import { useOpenClawCronJobs } from '@/features/cron/lib/use-openclaw-cron-jobs'
import OpenClawConnectionStatePanel from '@/features/instances/components/openclaw-connection-state-panel'
import OpenClawNoInstanceState from '@/features/instances/components/openclaw-no-instance-state'
import { useOpenClawConnectionActions } from '@/features/instances/lib/use-openclaw-connection-actions'
import { useAppStore } from '@/features/instances/store/use-app-store'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import AppShellContentArea from '@/shared/layout/app-shell-content-area'
import AppShellSplitWorkspace from '@/shared/layout/app-shell-split-workspace'
import { Button } from '@/shared/ui/button'
import { Switch } from '@/shared/ui/switch'

function OpenClawCronPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { t } = useAppI18n()
  const instances = useAppStore((state) => state.instances)
  const { connectInstance } = useOpenClawConnectionActions()
  const { selectedInstance } = useCronPageInstanceSelection(instances)
  const [reconnectingInstanceId, setReconnectingInstanceId] = useState<string | null>(null)
  const [editorState, setEditorState] = useState<{
    mode: 'create' | 'edit'
    job?: OpenClawCronJob
  } | null>(null)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const pageEnabled = selectedInstance?.connectionState === 'connected'
  const {
    jobs,
    schedulerStatus,
    loading,
    error,
    mutateKey,
    lastSuccessfulLoadAt,
    syncingRunJobIds,
    jobHasRecentOutputById,
    createJob,
    updateJob,
    runJob,
    removeJob
  } = useOpenClawCronJobs(selectedInstance?.id ?? null, pageEnabled)

  useEffect(() => {
    if (jobs.length === 0) {
      setSelectedJobId(null)
      return
    }

    setSelectedJobId((current) => {
      if (current && jobs.some((job) => job.id === current)) {
        return current
      }

      return jobs[0].id
    })
  }, [jobs])

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null,
    [jobs, selectedJobId]
  )
  const selectedJobHasRecentOutput = selectedJob
    ? jobHasRecentOutputById[selectedJob.id] === true
    : false
  const selectedJobRunHistoryRefreshToken = selectedJob
    ? `${selectedJob.state.lastRunAtMs ?? 'none'}:${selectedJobHasRecentOutput ? 'output' : 'pending'}`
    : null

  const selectedJobRunSyncing = selectedJob ? syncingRunJobIds.includes(selectedJob.id) : false
  const selectedJobSessionKey = selectedJob ? buildOpenClawCronSessionKey(selectedJob.id) : null

  const selectedJobMutatePrefix = selectedJob?.id ?? ''
  const selectedJobRunBusy = selectedJob ? mutateKey === `run:${selectedJobMutatePrefix}` : false
  const selectedJobToggleBusy = selectedJob
    ? mutateKey === `update:${selectedJobMutatePrefix}`
    : false
  const selectedJobRemoveBusy = selectedJob
    ? mutateKey === `remove:${selectedJobMutatePrefix}`
    : false
  const selectedJobRunPending = selectedJobRunBusy || selectedJobRunSyncing
  const selectedJobRunActionLabel = selectedJobRunBusy
    ? t('cron.page.action.runBusy')
    : selectedJobRunSyncing
      ? t('cron.page.action.runSyncing')
      : t('cron.page.action.run')
  const selectedJobRunActionDisabled = !selectedJob || selectedJobRunPending
  const selectedJobConfigActionDisabled =
    !selectedJob || selectedJobToggleBusy || selectedJobRemoveBusy
  const selectedJobSwitchDisabled = !selectedJob || selectedJobToggleBusy || selectedJobRemoveBusy
  const selectedJobDeleteDisabled = !selectedJob || selectedJobRemoveBusy || selectedJobToggleBusy
  const showingInitialLoading =
    jobs.length === 0 && (loading || (lastSuccessfulLoadAt === null && !error))

  const handleEditorSubmit = async (values: OpenClawCronFormValues): Promise<void> => {
    try {
      setEditorError(null)

      if (!selectedInstance) {
        throw new Error(t('cron.error.notSelectedInstance'))
      }

      if (editorState?.mode === 'edit' && editorState.job) {
        await updateJob(editorState.job.id, buildUpdateOpenClawCronPatch(values, editorState.job))
      } else {
        await createJob(buildCreateOpenClawCronPayload(values))
      }

      setEditorState(null)
      setEditorError(null)
    } catch (submitError) {
      setEditorError(submitError instanceof Error ? submitError.message : t('cron.error.saveJobFailed'))
    }
  }

  const selectedInstanceRequiresConnectionConfig =
    selectedInstance && selectedInstance.connectionConfig === null
  const selectedInstanceConnected = selectedInstance?.connectionState === 'connected'

  return (
    <AppShellContentArea
      disableInnerPadding
      contentScrollable={false}
      innerClassName="h-full min-h-0 gap-0"
    >
      {instances.length === 0 ? (
        <OpenClawNoInstanceState
          message={t('cron.page.noInstance')}
          onOpenConfig={() => navigate('/config')}
        />
      ) : !selectedInstance ? null : selectedInstanceRequiresConnectionConfig ||
        !selectedInstanceConnected ? (
        <OpenClawConnectionStatePanel
          instance={selectedInstance}
          reconnectPending={reconnectingInstanceId === selectedInstance.id}
          descriptionOverride={t('cron.page.needConnectionDescription')}
          onReconnect={(instance) => {
            setReconnectingInstanceId(instance.id)
            void connectInstance(instance, {
              optimisticConnecting: false
            }).finally(() => {
              setReconnectingInstanceId((current) => (current === instance.id ? null : current))
            })
          }}
          onOpenConfig={() => navigate('/config')}
        />
      ) : (
        <AppShellSplitWorkspace
          sidebar={
            <OpenClawCronJobsSidebar
              jobs={jobs}
              selectedJobId={selectedJob?.id ?? null}
              loading={showingInitialLoading}
              syncingRunJobIds={syncingRunJobIds}
              jobHasRecentOutputById={jobHasRecentOutputById}
              mutateKey={mutateKey}
              onSelectJob={setSelectedJobId}
              onRunJob={(job) => {
                void runJob(job.id)
              }}
              onEditJob={(job) => {
                setEditorError(null)
                setEditorState({ mode: 'edit', job })
              }}
              onDeleteJob={(job) => {
                if (!window.confirm(t('cron.common.confirmDeleteJob', { name: job.name }))) {
                  return
                }

                void removeJob(job.id)
              }}
              onCreateJob={() => {
                setEditorError(null)
                setEditorState({ mode: 'create' })
              }}
            />
          }
          contentHeader={
            showingInitialLoading ? (
              <div className="flex w-full min-w-0 items-center">
                <p className="text-sm text-muted-foreground">{t('cron.page.header.loadingJobContent')}</p>
              </div>
            ) : selectedJob ? (
              <div className="flex w-full min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                    {selectedJob.name}
                  </h2>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t('cron.page.header.enabled')}</span>
                  <Switch
                    aria-label={t('cron.page.header.jobSwitchAria', { name: selectedJob.name })}
                    checked={selectedJob.enabled}
                    disabled={!selectedJob || selectedJobSwitchDisabled}
                    onCheckedChange={(checked) => {
                      if (!selectedJob) {
                        return
                      }

                      void updateJob(selectedJob.id, {
                        enabled: checked
                      })
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex w-full min-w-0 items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{t('cron.page.header.selectJobHint')}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-[0.65rem] px-2.5 text-xs"
                  onClick={() => {
                    setEditorError(null)
                    setEditorState({ mode: 'create' })
                  }}
                >
                  {t('cron.page.header.createFirstJob')}
                </Button>
              </div>
            )
          }
          contentBodyClassName="flex min-h-0 flex-1 flex-col"
          contentFooter={
            showingInitialLoading ? undefined : (
              <div className="flex h-full items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-[0.65rem] text-primary hover:bg-primary/8 hover:text-primary"
                    aria-label={selectedJobRunActionLabel}
                    title={selectedJobRunActionLabel}
                    disabled={selectedJobRunActionDisabled}
                    onClick={() => {
                      if (!selectedJob) {
                        return
                      }

                      void runJob(selectedJob.id)
                    }}
                  >
                    {selectedJobRunPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-[0.65rem] text-muted-foreground hover:bg-black/5 hover:text-foreground"
                    aria-label={t('cron.page.action.config')}
                    title={t('cron.page.action.config')}
                    disabled={selectedJobConfigActionDisabled}
                    onClick={() => {
                      if (!selectedJob) {
                        return
                      }

                      setEditorError(null)
                      setEditorState({ mode: 'edit', job: selectedJob })
                    }}
                  >
                    <SlidersHorizontal className="size-3.5" />
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-[0.65rem] text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  aria-label={
                    selectedJobRemoveBusy ? t('cron.page.action.deleteBusy') : t('cron.page.action.delete')
                  }
                  title={
                    selectedJobRemoveBusy ? t('cron.page.action.deleteBusy') : t('cron.page.action.delete')
                  }
                  disabled={selectedJobDeleteDisabled}
                  onClick={() => {
                    if (!selectedJob) {
                      return
                    }

                    if (!window.confirm(t('cron.common.confirmDeleteJob', { name: selectedJob.name }))) {
                      return
                    }

                    void removeJob(selectedJob.id)
                  }}
                >
                  {selectedJobRemoveBusy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </Button>
              </div>
            )
          }
        >
          <div className="flex min-h-0 flex-1 flex-col">
            {schedulerStatus?.enabled === false ? (
              <section className="mx-4 mt-3 mb-3 flex items-start gap-3 rounded-[0.85rem] border border-orange-200 bg-orange-50 px-3.5 py-3 text-sm text-orange-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-600" />
                <div className="min-w-0">
                  <p className="font-medium">{t('cron.page.schedulerDisabled.title')}</p>
                  <p className="mt-1 leading-6 text-orange-800/85">
                    {t('cron.page.schedulerDisabled.description')}
                  </p>
                </div>
              </section>
            ) : null}

            {error ? (
              <section className="mx-4 mb-3 rounded-[0.85rem] border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
                {error}
              </section>
            ) : null}

            {showingInitialLoading ? (
              <section className="mx-4 mb-4 flex min-h-0 flex-1 flex-col items-center justify-center rounded-[0.85rem] border border-dashed border-black/10 bg-[#FBFCFE]">
                <Loader2 className="size-5 animate-spin text-primary" />
                <p className="mt-3 text-sm text-muted-foreground">{t('cron.page.content.loadingJobs')}</p>
              </section>
            ) : !selectedJob ? (
              <section className="mx-4 mb-4 flex min-h-0 flex-1 flex-col items-center justify-center rounded-[0.85rem] border border-dashed border-black/10 bg-[#FBFCFE] px-6 text-center">
                <p className="text-sm font-medium text-foreground">
                  {jobs.length === 0
                    ? t('cron.page.content.emptyNoJobsTitle')
                    : t('cron.page.content.emptySelectJobTitle')}
                </p>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  {jobs.length === 0
                    ? t('cron.page.content.emptyNoJobsDescription')
                    : t('cron.page.content.emptySelectJobDescription')}
                </p>
              </section>
            ) : (
              <section className="min-h-0 flex-1 overflow-hidden">
                <OpenClawCronRunHistory
                  instanceId={selectedInstance.id}
                  jobId={selectedJob.id}
                  enabled={Boolean(selectedJobSessionKey)}
                  refreshToken={selectedJobRunHistoryRefreshToken}
                  className="min-h-0 h-full"
                  innerClassName="h-full"
                  emptyTitle={t('cron.page.runHistory.emptyTitle')}
                  emptyDescription={t('cron.page.runHistory.emptyDescription')}
                />
              </section>
            )}
          </div>
        </AppShellSplitWorkspace>
      )}

      <OpenClawCronJobEditorDialog
        open={editorState !== null}
        mode={editorState?.mode ?? 'create'}
        job={editorState?.job}
        submitting={mutateKey === 'create' || mutateKey === `update:${editorState?.job?.id ?? ''}`}
        error={editorError}
        onClose={() => {
          if (mutateKey === 'create' || mutateKey === `update:${editorState?.job?.id ?? ''}`) {
            return
          }

          setEditorState(null)
          setEditorError(null)
        }}
        onSubmit={handleEditorSubmit}
      />
    </AppShellContentArea>
  )
}

export default OpenClawCronPage
