import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Loader2,
  RefreshCcw,
  Save
} from 'lucide-react'
import { useState } from 'react'

import { toMemoryListLabel } from '@/features/agents/lib/openclaw-agent-memory-files'
import type { OpenClawAgentFileEntry } from '@/features/agents/lib/openclaw-agents-types'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { cn } from '@/shared/lib/utils'
import DialogShell from '@/shared/ui/dialog-shell'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'

type OpenClawAgentMemoryTabProps = {
  rootFileNames: string[]
  folderFileNames: string[]
  folderExpanded: boolean
  folderLoading?: boolean
  files: OpenClawAgentFileEntry[]
  activeFileName: string | null
  draftContent: string
  loading?: boolean
  saving?: boolean
  deleting?: boolean
  canDeleteActiveFile?: boolean
  dirty?: boolean
  error?: string | null
  onToggleFolder: (expanded: boolean) => void
  onSelectFile: (fileName: string) => void
  onDraftChange: (content: string) => void
  onReload: () => void
  onReset: () => void
  onSave: () => void
  onDelete: () => void
}

function OpenClawAgentMemoryTab({
  rootFileNames,
  folderFileNames,
  folderExpanded,
  folderLoading = false,
  files,
  activeFileName,
  draftContent,
  loading = false,
  saving = false,
  deleting = false,
  canDeleteActiveFile = false,
  dirty = false,
  error,
  onToggleFolder,
  onSelectFile,
  onDraftChange,
  onReload,
  onSave,
  onDelete
}: OpenClawAgentMemoryTabProps): React.JSX.Element {
  const { t } = useAppI18n()
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const visibleRootFiles = rootFileNames
    .map((name) => files.find((entry) => entry.name === name) ?? null)
    .filter((entry): entry is OpenClawAgentFileEntry => Boolean(entry))
  const visibleFolderFiles = folderFileNames
    .map((name) => files.find((entry) => entry.name === name) ?? null)
    .filter((entry): entry is OpenClawAgentFileEntry => Boolean(entry))
  const visibleFiles = [...visibleRootFiles, ...visibleFolderFiles]

  const activeFileExists = activeFileName
    ? visibleFiles.some((entry) => entry.name === activeFileName)
    : false
  const editableFileName = activeFileExists ? activeFileName : (visibleFiles[0]?.name ?? null)
  const activeFileMissing =
    visibleFiles.find((entry) => entry.name === editableFileName)?.missing === true
  const saveButtonLabel = saving ? t('agents.memory.saveBusy') : t('agents.memory.save')
  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[230px] min-h-0 shrink-0 flex-col border-r border-black/6">
          <div className="shrink-0 border-b border-black/6 px-3 py-2 text-xs font-medium text-muted-foreground">
            {t('agents.memory.sidebarTitle')}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {rootFileNames.map((fileName) => {
                const file = visibleFiles.find((entry) => entry.name === fileName)
                const exists = Boolean(file)
                const missing = file?.missing === true
                const active = editableFileName === fileName

                return (
                  <button
                    key={fileName}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-[0.65rem] px-2.5 py-1.5 text-left text-xs transition-colors',
                      active
                        ? 'bg-primary/10 text-foreground'
                        : 'text-muted-foreground hover:bg-black/4 hover:text-foreground',
                      !exists && 'opacity-40'
                    )}
                    disabled={!exists || loading || deleting}
                    onClick={() => onSelectFile(fileName)}
                  >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <FileText className="size-3.5 shrink-0" />
                        <span className="truncate">{toMemoryListLabel(fileName)}</span>
                      </span>
                    {missing ? <span className="shrink-0 text-[10px]">{t('agents.memory.missingTag')}</span> : null}
                  </button>
                )
              })}

              <button
                type="button"
                aria-expanded={folderExpanded}
                aria-label={t('agents.memory.folderAria')}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-[0.65rem] px-2.5 py-1.5 text-left text-xs transition-colors',
                  'text-muted-foreground hover:bg-black/4 hover:text-foreground',
                  deleting && 'cursor-not-allowed opacity-60'
                )}
                disabled={deleting}
                onClick={() => onToggleFolder(!folderExpanded)}
              >
                  <span className="flex min-w-0 items-center gap-1.5">
                  {folderExpanded ? (
                    <ChevronDown className="size-3.5 shrink-0" />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0" />
                  )}
                  <Folder className="size-3.5 shrink-0" />
                  <span className="truncate">{t('agents.memory.folderName')}</span>
                </span>
                {folderLoading ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin" />
                ) : (
                  <span className="shrink-0 text-[10px]">{folderFileNames.length}</span>
                )}
              </button>

              {folderExpanded ? (
                <div className="ml-3 space-y-1 border-l border-black/8 pl-2">
                  {folderLoading ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      {t('agents.memory.folderLoading')}
                    </div>
                  ) : folderFileNames.length === 0 ? (
                    <p className="px-2 py-1 text-[11px] text-muted-foreground">{t('agents.memory.folderEmpty')}</p>
                  ) : (
                    folderFileNames.map((fileName) => {
                      const file = visibleFiles.find((entry) => entry.name === fileName)
                      const exists = Boolean(file)
                      const missing = file?.missing === true
                      const active = editableFileName === fileName

                      return (
                        <button
                          key={fileName}
                          type="button"
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-[0.65rem] px-2.5 py-1.5 text-left text-xs transition-colors',
                            active
                              ? 'bg-primary/10 text-foreground'
                              : 'text-muted-foreground hover:bg-black/4 hover:text-foreground',
                            !exists && 'opacity-40'
                          )}
                          disabled={!exists || loading || deleting}
                          onClick={() => onSelectFile(fileName)}
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            <FileText className="size-3.5 shrink-0" />
                            <span className="truncate">{toMemoryListLabel(fileName)}</span>
                          </span>
                          {missing ? <span className="shrink-0 text-[10px]">{t('agents.memory.missingTag')}</span> : null}
                        </button>
                      )
                    })
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/6 px-4 py-2.5">
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              {editableFileName ?? t('agents.memory.currentFileEmpty')}
            </p>
            {canDeleteActiveFile ? (
              <button
                type="button"
                className="h-auto bg-transparent p-0 text-xs font-medium text-rose-700 hover:underline disabled:cursor-not-allowed disabled:opacity-45"
                disabled={!editableFileName || loading || saving || deleting}
                onClick={() => setDeleteConfirmOpen(true)}
                aria-label={t('agents.memory.deleteCurrentAria')}
              >
                {t('agents.memory.deleteCurrent')}
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 px-4 py-3">
            <div className="relative h-full min-h-0">
              <Textarea
                density="sm"
                className="h-full min-h-0 resize-none rounded-[0.8rem] font-mono text-[12px] leading-5"
                value={editableFileName ? draftContent : ''}
                placeholder={
                  editableFileName
                    ? t('agents.memory.placeholderEdit', { fileName: editableFileName })
                    : t('agents.memory.placeholderEmpty')
                }
                disabled={!editableFileName || loading || deleting}
                onChange={(event) => onDraftChange(event.target.value)}
              />
              {loading || deleting ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[0.8rem] bg-background/72">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    {deleting ? t('agents.memory.overlayDeleting') : t('agents.memory.overlayLoading')}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
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
            disabled={!editableFileName || !dirty || saving || loading || deleting}
            onClick={onSave}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-[0.65rem] text-muted-foreground hover:bg-black/5 hover:text-foreground"
            aria-label={t('agents.memory.reload')}
            title={t('agents.memory.reload')}
            disabled={!editableFileName || loading || deleting}
            onClick={onReload}
          >
            <RefreshCcw className="size-3.5" />
          </Button>
        </div>
        {activeFileMissing ? (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {t('agents.memory.missingHint')}
          </span>
        ) : null}
      </footer>

      {error ? (
        <div className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      {deleteConfirmOpen && editableFileName && canDeleteActiveFile ? (
        <DialogShell
          title={t('agents.memory.deleteDialogTitle')}
          onClose={() => setDeleteConfirmOpen(false)}
          maxWidthClassName="max-w-[calc(100vw-1.5rem)] sm:max-w-[25rem]"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-end gap-2 border-t border-black/6 pt-3">
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-[0.7rem] px-3"
                disabled={deleting}
                onClick={() => setDeleteConfirmOpen(false)}
              >
                {t('agents.memory.cancel')}
              </Button>
              <Button
                type="button"
                className="h-9 rounded-[0.7rem] bg-rose-600 px-3 text-white hover:bg-rose-600/90"
                disabled={deleting}
                onClick={() => {
                  setDeleteConfirmOpen(false)
                  onDelete()
                }}
              >
                {deleting ? t('agents.memory.deleting') : t('agents.memory.confirmDelete')}
              </Button>
            </div>
          </div>
        </DialogShell>
      ) : null}
    </section>
  )
}

export default OpenClawAgentMemoryTab
