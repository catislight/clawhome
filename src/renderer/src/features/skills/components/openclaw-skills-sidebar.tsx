import { Loader2 } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { cn } from '@/shared/lib/utils'
import type { OpenClawSkillCategory, OpenClawSkillStatusEntry } from '@/features/skills/lib/openclaw-skills-types'

type OpenClawSkillsSidebarProps = {
  loading?: boolean
  category: OpenClawSkillCategory
  skills: OpenClawSkillStatusEntry[]
  selectedSkillKey: string | null
  creatingSkill?: boolean
  onCategoryChange: (category: OpenClawSkillCategory) => void
  onSelectSkill: (skillKey: string) => void
  onCreateSkill: () => void
}

function OpenClawSkillsSidebar({
  loading = false,
  category,
  skills,
  selectedSkillKey,
  creatingSkill = false,
  onCategoryChange,
  onSelectSkill,
  onCreateSkill
}: OpenClawSkillsSidebarProps): React.JSX.Element {
  const { t } = useAppI18n()
  const canCreateSkill = category === 'custom'

  return (
    <aside className="flex h-full min-h-0 w-[280px] shrink-0 flex-col border-r border-black/6 bg-[#FBFCFF]">
      <div className="flex h-[52px] shrink-0 items-center border-b border-black/6 px-3">
        <div
          className="grid w-full grid-cols-2 rounded-[0.75rem] bg-black/[0.04] p-1"
          role="tablist"
          aria-label={t('skills.sidebar.ariaSourceTabs')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={category === 'system'}
            className={cn(
              'h-8 rounded-[0.6rem] text-xs font-medium transition-colors',
              category === 'system'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onCategoryChange('system')}
          >
            {t('skills.sidebar.tab.system')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={category === 'custom'}
            className={cn(
              'h-8 rounded-[0.6rem] text-xs font-medium transition-colors',
              category === 'custom'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onCategoryChange('custom')}
          >
            {t('skills.sidebar.tab.custom')}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex h-full min-h-[180px] items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {t('skills.sidebar.loading')}
            </div>
          </div>
        ) : skills.length === 0 ? (
          <div className="rounded-[0.7rem] bg-white px-3 py-2.5 text-xs text-muted-foreground">
            {t('skills.sidebar.empty')}
          </div>
        ) : (
          skills.map((skill) => (
            <button
              key={skill.skillKey}
              type="button"
              aria-pressed={selectedSkillKey === skill.skillKey}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-[0.7rem] px-3 py-2.5 text-left transition-colors',
                selectedSkillKey === skill.skillKey ? 'bg-primary/10' : 'hover:bg-white'
              )}
              onClick={() => onSelectSkill(skill.skillKey)}
            >
              <span className="truncate text-sm font-medium text-foreground">{skill.name}</span>
              <span
                className={cn(
                  'shrink-0 text-xs',
                  skill.disabled ? 'text-muted-foreground' : 'text-emerald-600'
                )}
              >
                {skill.disabled ? t('skills.sidebar.state.disabled') : t('skills.sidebar.state.enabled')}
              </span>
            </button>
          ))
        )}
      </div>

      {canCreateSkill ? (
        <div className="flex h-[56px] shrink-0 items-center justify-center border-t border-black/6 px-3">
          <Button
            type="button"
            className="h-9 w-[80%] rounded-[0.72rem] px-5 text-sm"
            disabled={creatingSkill}
            onClick={onCreateSkill}
          >
            {creatingSkill ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('skills.sidebar.creating')}
              </>
            ) : (
              t('skills.sidebar.create')
            )}
          </Button>
        </div>
      ) : null}
    </aside>
  )
}

export default OpenClawSkillsSidebar
