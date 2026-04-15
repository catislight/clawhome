import { useState } from 'react'

import { Button } from '@/shared/ui/button'
import DialogShell from '@/shared/ui/dialog-shell'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { Input } from '@/shared/ui/input'

type OpenClawSkillCreateDialogProps = {
  open: boolean
  submitting?: boolean
  error?: string | null
  onClose: () => void
  onCreate: (name: string) => void
}

function OpenClawSkillCreateDialog({
  open,
  submitting = false,
  error,
  onClose,
  onCreate
}: OpenClawSkillCreateDialogProps): React.JSX.Element | null {
  const { t } = useAppI18n()
  const [name, setName] = useState('')

  if (!open) {
    return null
  }

  return (
    <DialogShell
      title={t('skills.createDialog.title')}
      onClose={onClose}
      maxWidthClassName="max-w-[calc(100vw-1.5rem)] md:max-w-[min(50vw,30rem)]"
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onCreate(name)
        }}
      >
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="new-skill-name">
            {t('skills.createDialog.nameLabel')}
          </label>
          <Input
            id="new-skill-name"
            density="sm"
            value={name}
            placeholder={t('skills.createDialog.namePlaceholder')}
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        {error ? (
          <p className="rounded-[0.6rem] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-[0.65rem] px-2.5 text-xs"
            disabled={submitting}
            onClick={onClose}
          >
            {t('skills.createDialog.cancel')}
          </Button>
          <Button
            type="submit"
            className="h-8 rounded-[0.65rem] px-2.5 text-xs"
            disabled={submitting}
          >
            {submitting ? t('skills.createDialog.submitting') : t('skills.createDialog.submit')}
          </Button>
        </div>
      </form>
    </DialogShell>
  )
}

export default OpenClawSkillCreateDialog
