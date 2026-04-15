import DialogShell from '@/shared/ui/dialog-shell'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Textarea } from '@/shared/ui/textarea'

type PromptTemplateEditorDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  title: string
  content: string
  tagsInput: string
  error: string | null
  onClose: () => void
  onTitleChange: (value: string) => void
  onContentChange: (value: string) => void
  onTagsInputChange: (value: string) => void
  onSubmit: () => void
}

function PromptTemplateEditorDialog({
  open,
  mode,
  title,
  content,
  tagsInput,
  error,
  onClose,
  onTitleChange,
  onContentChange,
  onTagsInputChange,
  onSubmit
}: PromptTemplateEditorDialogProps): React.JSX.Element | null {
  const { t } = useAppI18n()

  if (!open) {
    return null
  }

  return (
    <DialogShell
      title={
        mode === 'create' ? t('knowledgeBase.editor.title.create') : t('knowledgeBase.editor.title.edit')
      }
      onClose={onClose}
      maxWidthClassName="max-w-[calc(100vw-1rem)] lg:max-w-[min(46vw,34rem)]"
    >
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-foreground">{t('knowledgeBase.editor.field.title')}</span>
          <Input
            density="sm"
            value={title}
            maxLength={64}
            placeholder={t('knowledgeBase.editor.placeholder.title')}
            onChange={(event) => {
              onTitleChange(event.target.value)
            }}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-foreground">{t('knowledgeBase.editor.field.content')}</span>
          <Textarea
            density="sm"
            value={content}
            className="min-h-[180px]"
            placeholder={t('knowledgeBase.editor.placeholder.content')}
            onChange={(event) => {
              onContentChange(event.target.value)
            }}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-foreground">{t('knowledgeBase.editor.field.tags')}</span>
          <Input
            density="sm"
            value={tagsInput}
            maxLength={120}
            placeholder={t('knowledgeBase.editor.placeholder.tags')}
            onChange={(event) => {
              onTagsInputChange(event.target.value)
            }}
          />
        </label>

        {error ? (
          <p className="rounded-[0.6rem] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('knowledgeBase.editor.cancel')}
          </Button>
          <Button type="button" onClick={onSubmit}>
            {mode === 'create'
              ? t('knowledgeBase.editor.submit.create')
              : t('knowledgeBase.editor.submit.edit')}
          </Button>
        </div>
      </div>
    </DialogShell>
  )
}

export default PromptTemplateEditorDialog
