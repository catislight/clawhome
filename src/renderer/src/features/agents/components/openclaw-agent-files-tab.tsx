import { Loader2, RefreshCcw, Save } from 'lucide-react'

import type { OpenClawAgentFileEntry } from '@/features/agents/lib/openclaw-agents-types'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'

type OpenClawAgentFilesTabProps = {
  fileNames: string[]
  files: OpenClawAgentFileEntry[]
  activeFileName: string | null
  draftContent: string
  loading?: boolean
  saving?: boolean
  dirty?: boolean
  error?: string | null
  onSelectFile: (fileName: string) => void
  onDraftChange: (content: string) => void
  onReload: () => void
  onReset: () => void
  onSave: () => void
}

function OpenClawAgentFilesTab({
  fileNames,
  files,
  activeFileName,
  draftContent,
  loading = false,
  saving = false,
  dirty = false,
  error,
  onSelectFile,
  onDraftChange,
  onReload,
  onSave
}: OpenClawAgentFilesTabProps): React.JSX.Element {
  const { t } = useAppI18n()
  const visibleFiles = fileNames
    .map((name) => files.find((entry) => entry.name === name) ?? null)
    .filter((entry): entry is OpenClawAgentFileEntry => Boolean(entry))

  const activeFileExists = activeFileName
    ? visibleFiles.some((entry) => entry.name === activeFileName)
    : false
  const editableFileName = activeFileExists ? activeFileName : (visibleFiles[0]?.name ?? null)
  const activeFileMissing =
    visibleFiles.find((entry) => entry.name === editableFileName)?.missing === true
  const saveButtonLabel = saving ? t('agents.files.saveBusy') : t('agents.files.save')
  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-black/6 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {fileNames.map((fileName) => {
              const file = visibleFiles.find((entry) => entry.name === fileName)
              const exists = Boolean(file)
              const missing = file?.missing === true
              const active = editableFileName === fileName

              return (
                <button
                  key={fileName}
                  type="button"
                  className={cn(
                    'rounded-[0.62rem] border px-2.5 py-1 text-[11px] transition-colors',
                    active
                      ? 'border-primary/30 bg-primary/10 text-foreground'
                      : 'border-black/8 text-muted-foreground hover:bg-black/4 hover:text-foreground',
                    !exists && 'opacity-40'
                  )}
                  disabled={!exists || loading}
                  onClick={() => onSelectFile(fileName)}
                >
                  {fileName}
                  {missing ? t('agents.files.missingSuffix') : ''}
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 px-4 py-3">
          <Textarea
            density="sm"
            className="h-full min-h-0 resize-none rounded-[0.8rem] font-mono text-[12px] leading-5"
            value={editableFileName ? draftContent : ''}
            placeholder={
              editableFileName
                ? t('agents.files.placeholderEdit', { fileName: editableFileName })
                : t('agents.files.placeholderEmpty')
            }
            disabled={!editableFileName || loading}
            onChange={(event) => onDraftChange(event.target.value)}
          />
        </div>
      </div>

      <footer className="flex h-[56px] shrink-0 items-center gap-3 border-t border-black/6 px-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-[0.65rem] text-primary hover:bg-primary/8 hover:text-primary"
            aria-label={saveButtonLabel}
            title={saveButtonLabel}
            disabled={!editableFileName || !dirty || saving || loading}
            onClick={onSave}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-[0.65rem] text-muted-foreground hover:bg-black/5 hover:text-foreground"
            aria-label={t('agents.files.reload')}
            title={t('agents.files.reload')}
            disabled={!editableFileName || loading}
            onClick={onReload}
          >
            <RefreshCcw className="size-3.5" />
          </Button>
        </div>
        {activeFileMissing ? (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {t('agents.files.missingHint')}
          </span>
        ) : null}
      </footer>

      {error ? (
        <div className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}
    </section>
  )
}

export default OpenClawAgentFilesTab
