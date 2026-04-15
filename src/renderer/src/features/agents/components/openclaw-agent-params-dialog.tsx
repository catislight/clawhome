import { useEffect, useState } from 'react'

import { useAppI18n } from '@/shared/i18n/app-i18n'
import { Button } from '@/shared/ui/button'
import DialogShell from '@/shared/ui/dialog-shell'
import { Textarea } from '@/shared/ui/textarea'

type OpenClawAgentParamsDialogProps = {
  open: boolean
  initialValue: string
  error?: string | null
  onClose: () => void
  onSubmit: (nextValue: string) => void
}

function OpenClawAgentParamsDialog({
  open,
  initialValue,
  error,
  onClose,
  onSubmit
}: OpenClawAgentParamsDialogProps): React.JSX.Element | null {
  const { t } = useAppI18n()
  const [draftValue, setDraftValue] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }
    setDraftValue(initialValue)
  }, [initialValue, open])

  if (!open) {
    return null
  }

  return (
    <DialogShell
      title={t('agents.params.title')}
      maxWidthClassName="max-w-[calc(100vw-1rem)] sm:max-w-[38rem]"
      onClose={onClose}
    >
      <Textarea
        density="sm"
        className="min-h-[280px] font-mono text-xs"
        value={draftValue}
        placeholder={t('agents.params.placeholder')}
        onChange={(event) => {
          setDraftValue(event.target.value)
        }}
      />

      {error ? (
        <p className="mt-3 rounded-[0.65rem] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-black/6 pt-3">
        <Button
          type="button"
          variant="outline"
          className="h-8 rounded-[0.7rem] px-2.5 text-xs"
          onClick={onClose}
        >
          {t('agents.params.cancel')}
        </Button>
        <Button
          type="button"
          className="h-8 rounded-[0.7rem] px-2.5 text-xs"
          onClick={() => onSubmit(draftValue)}
        >
          {t('agents.params.apply')}
        </Button>
      </div>
    </DialogShell>
  )
}

export default OpenClawAgentParamsDialog
