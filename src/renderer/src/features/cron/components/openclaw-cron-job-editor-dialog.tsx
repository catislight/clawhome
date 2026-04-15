import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/shared/ui/button'
import DialogShell from '@/shared/ui/dialog-shell'
import OpenClawCronJobForm from '@/features/cron/components/openclaw-cron-job-form'
import { createInitialOpenClawCronFormValues } from '@/features/cron/lib/openclaw-cron-form'
import type {
  OpenClawCronFormValues,
  OpenClawCronJob
} from '@/features/cron/lib/openclaw-cron-types'
import { useAppI18n } from '@/shared/i18n/app-i18n'

type OpenClawCronJobEditorDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  job?: OpenClawCronJob | null
  submitting: boolean
  error: string | null
  onClose: () => void
  onSubmit: (values: OpenClawCronFormValues) => Promise<void>
}

function OpenClawCronJobEditorDialog({
  open,
  mode,
  job,
  submitting,
  error,
  onClose,
  onSubmit
}: OpenClawCronJobEditorDialogProps): React.JSX.Element | null {
  if (!open) {
    return null
  }

  return (
    <OpenClawCronJobEditorDialogContent
      key={job?.id ?? 'create'}
      mode={mode}
      job={job}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}

type OpenClawCronJobEditorDialogContentProps = Omit<OpenClawCronJobEditorDialogProps, 'open'>

function OpenClawCronJobEditorDialogContent({
  mode,
  job,
  submitting,
  error,
  onClose,
  onSubmit
}: OpenClawCronJobEditorDialogContentProps): React.JSX.Element {
  const { t } = useAppI18n()
  const [values, setValues] = useState<OpenClawCronFormValues>(() =>
    createInitialOpenClawCronFormValues(job)
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    await onSubmit(values)
  }

  return (
    <DialogShell
      title={mode === 'create' ? t('cron.editor.titleCreate') : t('cron.editor.titleEdit')}
      maxWidthClassName="max-w-none"
      dialogStyle={{ width: 'min(40rem, calc(100vw - 1rem))' }}
      onClose={() => {
        if (submitting) {
          return
        }

        onClose()
      }}
    >
      <form className="flex flex-col gap-5" onSubmit={(event) => void handleSubmit(event)}>
        <OpenClawCronJobForm
          values={values}
          onChange={(field, value) => {
            setValues((current) => ({
              ...current,
              [field]: value
            }))
          }}
        />

        {error ? <p className="text-sm leading-6 text-rose-600">{error}</p> : null}

        <div className="flex justify-end gap-3 border-t border-black/6 pt-5">
          <Button
            type="button"
            variant="outline"
            className="rounded-[0.8rem]"
            disabled={submitting}
            onClick={onClose}
          >
            {t('cron.editor.cancel')}
          </Button>
          <Button type="submit" className="rounded-[0.8rem]" disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === 'create' ? t('cron.editor.submitCreate') : t('cron.editor.submitSave')}
          </Button>
        </div>
      </form>
    </DialogShell>
  )
}

export default OpenClawCronJobEditorDialog
