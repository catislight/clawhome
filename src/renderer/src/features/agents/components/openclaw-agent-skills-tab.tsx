import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

import type { OpenClawSkillStatusEntry } from '@/features/skills/lib/openclaw-skills-types'
import {
  filterOpenClawSkillsByCategory,
  sortOpenClawSkillsByName
} from '@/features/skills/lib/openclaw-skills-selectors'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { Button } from '@/shared/ui/button'
import DialogShell from '@/shared/ui/dialog-shell'
import { Switch } from '@/shared/ui/switch'

type OpenClawAgentSkillsTabProps = {
  loading?: boolean
  saving?: boolean
  error?: string | null
  skills: OpenClawSkillStatusEntry[]
  resolveEnabled: (skill: OpenClawSkillStatusEntry) => boolean
  onToggleSkill: (skill: OpenClawSkillStatusEntry, enabled: boolean) => void
}

function OpenClawAgentSkillsTab({
  loading = false,
  saving = false,
  error,
  skills,
  resolveEnabled,
  onToggleSkill
}: OpenClawAgentSkillsTabProps): React.JSX.Element {
  const { t } = useAppI18n()
  const [detailSkill, setDetailSkill] = useState<OpenClawSkillStatusEntry | null>(null)
  const skillGroups = useMemo(
    () =>
      [
        {
          id: 'system',
          label: t('agents.skills.group.system'),
          skills: sortOpenClawSkillsByName(filterOpenClawSkillsByCategory(skills, 'system'))
        },
        {
          id: 'custom',
          label: t('agents.skills.group.custom'),
          skills: sortOpenClawSkillsByName(filterOpenClawSkillsByCategory(skills, 'custom'))
        }
      ].filter((group) => group.skills.length > 0),
    [skills, t]
  )

  if (loading) {
    return (
      <section className="flex h-full min-h-0 items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {t('agents.skills.loading')}
        </div>
      </section>
    )
  }

  if (skills.length === 0) {
    return (
      <section className="px-4 py-4">
        <div className="rounded-[0.75rem] bg-[#F8FAFD] px-3 py-2.5 text-xs text-muted-foreground">
          {t('agents.skills.empty')}
        </div>
      </section>
    )
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      {error ? (
        <div className="shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-5">
          {skillGroups.map((group) => (
            <section key={group.id}>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h3>
              <div className="grid gap-3 xl:grid-cols-2">
                {group.skills.map((skill) => {
                  const enabled = resolveEnabled(skill)

                  return (
                    <article
                      key={skill.skillKey}
                      className="flex min-h-[122px] flex-col justify-between rounded-[0.8rem] border border-black/8 bg-white px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{skill.name}</p>
                        <Switch
                          aria-label={t('agents.skills.switchAria', { name: skill.name })}
                          checked={enabled}
                          disabled={saving}
                          onCheckedChange={(checked) => onToggleSkill(skill, checked)}
                        />
                      </div>

                      <div className="mt-2 flex items-end justify-between gap-3">
                        <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {skill.description || t('agents.skills.descriptionEmpty')}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-7 shrink-0 rounded-[0.6rem] px-2 text-xs text-primary hover:bg-primary/8"
                          onClick={() => setDetailSkill(skill)}
                        >
                          {t('agents.skills.viewDetail')}
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {detailSkill ? (
        <DialogShell
          title={detailSkill.name}
          maxWidthClassName="max-w-[calc(100vw-1rem)] sm:max-w-[38rem]"
          onClose={() => setDetailSkill(null)}
        >
          <div className="space-y-2">
            <div className="space-y-2 rounded-[0.75rem] border border-black/8 bg-background px-3 py-2 text-xs text-muted-foreground">
              <p>{t('agents.skills.detail.source', { value: detailSkill.source })}</p>
              <p>
                {t('agents.skills.detail.type', {
                  value: detailSkill.bundled
                    ? t('agents.skills.detail.typeSystem')
                    : t('agents.skills.detail.typeCustom')
                })}
              </p>
              <p>
                {t('agents.skills.detail.eligible', {
                  value: detailSkill.eligible
                    ? t('agents.skills.detail.eligibleYes')
                    : t('agents.skills.detail.eligibleNo')
                })}
              </p>
              <p className="break-all">{t('agents.skills.detail.file', { path: detailSkill.filePath })}</p>
            </div>
          </div>
        </DialogShell>
      ) : null}
    </section>
  )
}

export default OpenClawAgentSkillsTab
