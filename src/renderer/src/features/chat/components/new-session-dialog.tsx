import { Button } from '@/shared/ui/button'
import DialogShell from '@/shared/ui/dialog-shell'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { Input } from '@/shared/ui/input'

type NewSessionDialogProps = {
  nameDraft: string
  canCreateConversation: boolean
  onNameDraftChange: (value: string) => void
  onClose: () => void
  onCreate: () => void
}

function NewSessionDialog({
  nameDraft,
  canCreateConversation,
  onNameDraftChange,
  onClose,
  onCreate
}: NewSessionDialogProps): React.JSX.Element {
  const { t } = useAppI18n()

  return (
    <DialogShell
      title={t('chat.newSession.title')}
      onClose={onClose}
      maxWidthClassName="max-w-[calc(100vw-1.5rem)] sm:max-w-[29rem] lg:max-w-[min(46vw,29rem)]"
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-foreground/82">{t('chat.newSession.description')}</p>

        <div className="space-y-2">
          <label htmlFor="home-new-session-name" className="text-sm font-medium text-foreground">
            {t('chat.newSession.nameLabel')}
          </label>
          <Input
            id="home-new-session-name"
            density="sm"
            value={nameDraft}
            onChange={(event) => onNameDraftChange(event.target.value)}
            placeholder={t('chat.newSession.namePlaceholder')}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-black/6 pt-3">
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-[0.75rem] px-4"
            onClick={onClose}
          >
            {t('chat.newSession.cancel')}
          </Button>
          <Button
            type="button"
            variant="default"
            className="h-10 rounded-[0.75rem] px-4"
            disabled={!canCreateConversation}
            onClick={onCreate}
          >
            {t('chat.newSession.create')}
          </Button>
        </div>
      </div>
    </DialogShell>
  )
}

export default NewSessionDialog
