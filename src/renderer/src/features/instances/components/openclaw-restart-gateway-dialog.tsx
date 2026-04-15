import type { OpenClawInstance } from '@/features/instances/store/use-app-store'
import { Button } from '@/shared/ui/button'
import DialogShell from '@/shared/ui/dialog-shell'
import { useAppI18n } from '@/shared/i18n/app-i18n'

type OpenClawRestartGatewayDialogProps = {
  targetInstance: OpenClawInstance | null
  submitting: boolean
  onClose: () => void
  onConfirm: (instance: OpenClawInstance) => void
}

function OpenClawRestartGatewayDialog({
  targetInstance,
  submitting,
  onClose,
  onConfirm
}: OpenClawRestartGatewayDialogProps): React.JSX.Element | null {
  const { t } = useAppI18n()

  if (!targetInstance) {
    return null
  }

  return (
    <DialogShell
      title={t('instances.restartDialog.title', { name: targetInstance.name })}
      onClose={onClose}
      maxWidthClassName="max-w-[calc(100vw-1.5rem)] sm:max-w-[25rem]"
    >
      <div className="flex items-center justify-end gap-2 border-t border-black/6 pt-3">
        <Button
          type="button"
          variant="ghost"
          className="h-9 rounded-[0.7rem] px-3"
          disabled={submitting}
          onClick={onClose}
        >
          {t('instances.restartDialog.action.cancel')}
        </Button>
        <Button
          type="button"
          className="h-9 rounded-[0.7rem] px-3"
          disabled={submitting}
          onClick={() => onConfirm(targetInstance)}
        >
          {submitting
            ? t('instances.restartDialog.action.restarting')
            : t('instances.restartDialog.action.confirm')}
        </Button>
      </div>
    </DialogShell>
  )
}

export default OpenClawRestartGatewayDialog
