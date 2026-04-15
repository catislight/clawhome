import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import type { OpenClawToolProfilePresetId } from '@/features/agents/lib/openclaw-agents-center-types'
import type {
  OpenClawToolCatalogEntry,
  OpenClawToolCatalogGroup
} from '@/features/agents/lib/openclaw-agents-types'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { Button } from '@/shared/ui/button'
import DialogShell from '@/shared/ui/dialog-shell'
import { Switch } from '@/shared/ui/switch'

export type OpenClawToolProfilePreset = {
  id: OpenClawToolProfilePresetId
  active: boolean
}

type OpenClawAgentToolsTabProps = {
  loading?: boolean
  saving?: boolean
  error?: string | null
  groups: OpenClawToolCatalogGroup[]
  profilePresets: OpenClawToolProfilePreset[]
  onSelectProfilePreset: (presetId: OpenClawToolProfilePresetId) => void
  resolveEnabled: (tool: OpenClawToolCatalogEntry) => boolean
  onToggleTool: (tool: OpenClawToolCatalogEntry, enabled: boolean) => void
}

function OpenClawAgentToolsTab({
  loading = false,
  saving = false,
  error,
  groups,
  profilePresets,
  onSelectProfilePreset,
  resolveEnabled,
  onToggleTool
}: OpenClawAgentToolsTabProps): React.JSX.Element {
  const { t } = useAppI18n()
  const [detailTool, setDetailTool] = useState<OpenClawToolCatalogEntry | null>(null)
  const resolvePresetLabel = (presetId: OpenClawToolProfilePresetId): string => {
    if (presetId === 'minimal') {
      return t('agents.tools.preset.minimal')
    }
    if (presetId === 'coding') {
      return t('agents.tools.preset.coding')
    }
    if (presetId === 'messaging') {
      return t('agents.tools.preset.messaging')
    }
    if (presetId === 'full') {
      return t('agents.tools.preset.full')
    }
    return t('agents.tools.preset.inherit')
  }

  if (loading) {
    return (
      <section className="flex h-full min-h-0 items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {t('agents.tools.loading')}
        </div>
      </section>
    )
  }

  if (groups.length === 0) {
    return (
      <section className="px-4 py-4">
        <div className="rounded-[0.75rem] bg-[#F8FAFD] px-3 py-2.5 text-xs text-muted-foreground">
          {t('agents.tools.empty')}
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

      <div className="shrink-0 border-b border-black/6 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('agents.tools.preset')}</span>
          {profilePresets.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant={preset.active ? 'default' : 'outline'}
              className="h-7 rounded-[0.6rem] px-2.5 text-xs"
              disabled={saving}
              onClick={() => onSelectProfilePreset(preset.id)}
            >
              {resolvePresetLabel(preset.id)}
            </Button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.id}>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h3>
              <div className="grid gap-3 xl:grid-cols-2">
                {group.tools.map((tool) => {
                  const enabled = resolveEnabled(tool)

                  return (
                    <article
                      key={tool.id}
                      className="flex min-h-[122px] flex-col justify-between rounded-[0.8rem] border border-black/8 bg-white px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{tool.label}</p>
                        <Switch
                          aria-label={t('agents.tools.switchAria', { name: tool.label })}
                          checked={enabled}
                          disabled={saving}
                          onCheckedChange={(checked) => onToggleTool(tool, checked)}
                        />
                      </div>

                      <div className="mt-2 flex items-end justify-between gap-3">
                        <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {tool.description}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-7 shrink-0 rounded-[0.6rem] px-2 text-xs text-primary hover:bg-primary/8"
                          onClick={() => setDetailTool(tool)}
                        >
                          {t('agents.tools.viewDetail')}
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

      {detailTool ? (
        <DialogShell
          title={detailTool.label}
          maxWidthClassName="max-w-[calc(100vw-1rem)] sm:max-w-[38rem]"
          onClose={() => setDetailTool(null)}
        >
          <div className="space-y-2">
            <p className="text-sm leading-6 text-muted-foreground">{detailTool.description}</p>
            <div className="rounded-[0.75rem] border border-black/8 bg-background px-3 py-2 text-xs">
              <p>
                {t('agents.tools.detail.source', {
                  value:
                    detailTool.source === 'plugin'
                      ? t('agents.tools.detail.sourcePlugin', {
                          pluginId: detailTool.pluginId ?? ''
                        })
                      : t('agents.tools.detail.sourceBuiltin')
                })}
              </p>
              <p className="mt-1">
                {t('agents.tools.detail.defaultProfile', {
                  value:
                    detailTool.defaultProfiles.length > 0
                      ? detailTool.defaultProfiles.join(', ')
                      : t('agents.tools.detail.defaultProfileNone')
                })}
              </p>
              {detailTool.optional ? <p className="mt-1">{t('agents.tools.detail.optional')}</p> : null}
            </div>
          </div>
        </DialogShell>
      ) : null}
    </section>
  )
}

export default OpenClawAgentToolsTab
