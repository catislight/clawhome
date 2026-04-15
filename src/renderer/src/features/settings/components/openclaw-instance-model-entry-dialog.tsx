import { useEffect, useState } from 'react'

import type { ModelEntryDialogPayload } from '@/features/settings/lib/openclaw-instance-global-config-types'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { Button } from '@/shared/ui/button'
import DialogShell from '@/shared/ui/dialog-shell'
import { Input } from '@/shared/ui/input'
import { Textarea } from '@/shared/ui/textarea'

type OpenClawInstanceModelEntryDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  errorMessage?: string | null
  initialValue?: {
    ref: string
    alias: string
    paramsText: string
  }
  onClose: () => void
  onSubmit: (payload: ModelEntryDialogPayload) => void
}

function OpenClawInstanceModelEntryDialog({
  open,
  mode,
  errorMessage,
  initialValue,
  onClose,
  onSubmit
}: OpenClawInstanceModelEntryDialogProps): React.JSX.Element | null {
  const { t } = useAppI18n()
  const [ref, setRef] = useState('')
  const [alias, setAlias] = useState('')
  const [paramsText, setParamsText] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }

    setRef(initialValue?.ref ?? '')
    setAlias(initialValue?.alias ?? '')
    setParamsText(initialValue?.paramsText ?? '')
  }, [initialValue, open])

  if (!open) {
    return null
  }

  return (
    <DialogShell
      title={
        mode === 'create' ? t('settings.modelEntryDialog.title.create') : t('settings.modelEntryDialog.title.edit')
      }
      maxWidthClassName="max-w-[calc(100vw-1rem)] sm:max-w-[42rem]"
      onClose={onClose}
    >
      <div className="space-y-3">
        {errorMessage ? (
          <p className="rounded-[0.6rem] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-muted-foreground">{t('settings.modelEntryDialog.field.ref')}</span>
            <Input
              density="sm"
              value={ref}
              placeholder={t('settings.modelEntryDialog.placeholder.ref')}
              onChange={(event) => {
                setRef(event.target.value)
              }}
            />
          </label>

          <label className="space-y-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-muted-foreground">{t('settings.modelEntryDialog.field.alias')}</span>
            <Input
              density="sm"
              value={alias}
              placeholder={t('settings.modelEntryDialog.placeholder.alias')}
              onChange={(event) => {
                setAlias(event.target.value)
              }}
            />
          </label>
        </div>

        <label className="space-y-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-muted-foreground">{t('settings.modelEntryDialog.field.params')}</span>
          <Textarea
            density="sm"
            value={paramsText}
            className="min-h-40 font-mono text-xs"
            placeholder={t('settings.modelEntryDialog.placeholder.params')}
            onChange={(event) => {
              setParamsText(event.target.value)
            }}
          />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-black/6 pt-3">
        <Button
          type="button"
          variant="outline"
          className="h-8 rounded-[0.7rem] px-2.5 text-xs"
          onClick={onClose}
        >
          {t('settings.common.cancel')}
        </Button>
        <Button
          type="button"
          className="h-8 rounded-[0.7rem] px-2.5 text-xs"
          onClick={() => {
            onSubmit({
              ref,
              alias,
              paramsText
            })
          }}
        >
          {t('settings.modelEntryDialog.save')}
        </Button>
      </div>
    </DialogShell>
  )
}

export default OpenClawInstanceModelEntryDialog
