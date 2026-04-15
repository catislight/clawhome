import { Loader2, RefreshCcw, Save, Trash2 } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'
import type { OpenClawSkillStatusEntry } from '@/features/skills/lib/openclaw-skills-types'

type OpenClawSkillContentPanelProps = {
  loading?: boolean
  skill: OpenClawSkillStatusEntry | null
  loadingContent?: boolean
  savingContent?: boolean
  updatingEnabled?: boolean
  deletingSkill?: boolean
  draftContent: string
  dirty: boolean
  error?: string | null
  onDraftChange: (content: string) => void
  onReload: () => void
  onReset: () => void
  onSave: () => void
  onToggleEnabled: (enabled: boolean) => void
  onDeleteCustomSkill?: () => void
}

function OpenClawSkillContentPanel({
  loading = false,
  skill,
  loadingContent = false,
  savingContent = false,
  updatingEnabled = false,
  deletingSkill = false,
  draftContent,
  dirty,
  error,
  onDraftChange,
  onReload,
  onSave,
  onToggleEnabled,
  onDeleteCustomSkill
}: OpenClawSkillContentPanelProps): React.JSX.Element {
  const { t } = useAppI18n()
  const showingInitialLoading = loading && !skill
  const saveButtonLabel = savingContent ? t('skills.content.saving') : t('skills.content.save')

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-black/6 px-4">
        <p className="truncate text-sm font-semibold tracking-tight text-foreground">
          {skill?.name ?? t('skills.content.titleFallback')}
        </p>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{t('skills.content.enabledLabel')}</span>
          <Switch
            aria-label={t('skills.content.switchAria', {
              name: skill?.name ?? t('skills.content.switchFallbackName')
            })}
            checked={skill ? !skill.disabled : false}
            disabled={!skill || showingInitialLoading || updatingEnabled || deletingSkill}
            onCheckedChange={(checked) => {
              if (!skill) {
                return
              }

              onToggleEnabled(checked)
            }}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        {showingInitialLoading || loadingContent ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-[0.8rem] border border-black/8 bg-background">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('skills.content.loading')}
            </div>
          </div>
        ) : !skill ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-[0.8rem] border border-black/8 bg-background">
            <p className="text-sm text-muted-foreground">{t('skills.content.empty')}</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <Textarea
              value={draftContent}
              density="sm"
              className="h-full min-h-0 resize-none rounded-[0.8rem] font-mono text-[12px] leading-5"
              placeholder={t('skills.content.placeholder')}
              disabled={savingContent}
              onChange={(event) => onDraftChange(event.target.value)}
            />
          </div>
        )}
      </div>

      <footer className="h-[56px] shrink-0 border-t border-black/6 px-4">
        <div className="flex h-full items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-[0.65rem] text-primary hover:bg-primary/8 hover:text-primary"
              aria-label={saveButtonLabel}
              title={saveButtonLabel}
              disabled={!skill || !dirty || loadingContent || savingContent || deletingSkill}
              onClick={onSave}
            >
              {savingContent ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-[0.65rem] text-muted-foreground hover:bg-black/5 hover:text-foreground"
              aria-label={t('skills.content.refresh')}
              title={t('skills.content.refresh')}
              disabled={!skill || loadingContent || savingContent || deletingSkill}
              onClick={onReload}
            >
              <RefreshCcw className="size-3.5" />
            </Button>

            {error ? (
              <p className="ml-2 truncate text-xs text-rose-700" title={error}>
                {error}
              </p>
            ) : null}
          </div>

          {skill && !skill.bundled && onDeleteCustomSkill ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-[0.65rem] text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              aria-label={deletingSkill ? t('skills.content.deleteBusy') : t('skills.content.delete')}
              title={deletingSkill ? t('skills.content.deleteBusy') : t('skills.content.delete')}
              disabled={loadingContent || savingContent || deletingSkill}
              onClick={onDeleteCustomSkill}
            >
              {deletingSkill ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          ) : null}
        </div>
      </footer>
    </section>
  )
}

export default OpenClawSkillContentPanel
