import { useState } from 'react'

import OpenClawConnectionFormFields, {
  applyOpenClawConnectionFormField,
  createOpenClawConnectionFormState,
  isOpenClawConnectionFormStateValid,
  normalizeOpenClawConnectionFormState,
  type OpenClawConnectionFormState
} from '@/features/instances/components/openclaw-connection-form-fields'
import { Button } from '@/shared/ui/button'
import DialogShell from '@/shared/ui/dialog-shell'
import type { OpenClawInstance } from '@/features/instances/store/use-app-store'
import { useAppI18n } from '@/shared/i18n/app-i18n'

type OpenClawConnectionDialogProps = {
  instance: OpenClawInstance | null
  open: boolean
  onClose: () => void
  onSave: (instanceId: string, values: OpenClawConnectionFormState) => void
}

function OpenClawConnectionDialog({
  instance,
  open,
  onClose,
  onSave
}: OpenClawConnectionDialogProps): React.JSX.Element | null {
  if (!open || !instance) {
    return null
  }

  return (
    <OpenClawConnectionDialogContent
      key={instance.id}
      instance={instance}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

type OpenClawConnectionDialogContentProps = {
  instance: OpenClawInstance
  onClose: () => void
  onSave: (instanceId: string, values: OpenClawConnectionFormState) => void
}

function OpenClawConnectionDialogContent({
  instance,
  onClose,
  onSave
}: OpenClawConnectionDialogContentProps): React.JSX.Element {
  const { t } = useAppI18n()
  const [formValues, setFormValues] = useState<OpenClawConnectionFormState>(() =>
    createOpenClawConnectionFormState({
      instanceName: instance.name,
      connectionConfig: instance.connectionConfig
    })
  )

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    const normalizedValues = normalizeOpenClawConnectionFormState(formValues)

    if (!isOpenClawConnectionFormStateValid(normalizedValues)) {
      return
    }

    onSave(instance.id, normalizedValues)
  }

  return (
    <DialogShell
      title={t('instances.connectionDialog.title', { name: instance.name })}
      maxWidthClassName="max-w-none"
      dialogStyle={{ width: 'min(32rem, calc(100vw - 1rem))' }}
      onClose={onClose}
    >
      <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
        <OpenClawConnectionFormFields
          values={formValues}
          onValueChange={(field, value) => {
            setFormValues((current) => applyOpenClawConnectionFormField(current, field, value))
          }}
        />

        <div
          data-testid="dialog-footer"
          className="mt-2 flex justify-end gap-4 border-t border-black/6 pt-4 pb-1"
        >
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-[0.75rem] px-3.5 text-sm"
            onClick={onClose}
          >
            {t('instances.connectionDialog.action.cancel')}
          </Button>
          <Button type="submit" className="h-9 rounded-[0.75rem] px-3.5 text-sm">
            {t('instances.connectionDialog.action.save')}
          </Button>
        </div>
      </form>
    </DialogShell>
  )
}

export default OpenClawConnectionDialog
