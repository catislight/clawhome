import { Loader2, RefreshCcw, Save } from 'lucide-react'
import { useEffect, useMemo } from 'react'

import { createEmptyOpenClawAgentSettingsDraft } from '@/features/agents/lib/openclaw-agents-center-constants'
import type { OpenClawAgentSettingsDraft } from '@/features/agents/lib/openclaw-agent-config-entry'
import { createAgentsCenterSettingsFormComponentMap } from '@/features/agents/lib/agents-center-settings-form-component-map'
import {
  buildAgentsCenterSettingsFormLayout,
  buildAgentsCenterSettingsFormFields
} from '@/features/agents/lib/agents-center-settings-form-config'
import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import { AGENTS_CENTER_SETTINGS_FORM_SCHEMA } from '@/features/agents/lib/agents-center-settings-form-schema'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { DynamicFormRenderer, useDynamicFormEngine } from '@/shared/lib/dynamic-form-engine'
import { Button } from '@/shared/ui/button'

type OpenClawAgentSettingsTabProps = {
  draft: OpenClawAgentSettingsDraft
  modelOptions: string[]
  allowAgentOptions: string[]
  connectionConfig?: SshConnectionFormValues | null
  fallbackWorkspace?: string
  loadingModels?: boolean
  saving?: boolean
  error?: string | null
  onDraftChange: (patch: Partial<OpenClawAgentSettingsDraft>) => void
  onGenerateId: () => void
  onOpenParamsDialog: () => void
  onSave: (nextDraft: OpenClawAgentSettingsDraft) => void
  onReload: () => void
}

function toComparableDraft(value: OpenClawAgentSettingsDraft): string {
  return JSON.stringify({
    id: value.id,
    default: value.default,
    name: value.name,
    emoji: value.emoji,
    avatar: value.avatar,
    workspace: value.workspace,
    agentDir: value.agentDir,
    model: value.model,
    paramsJson: value.paramsJson,
    subagentsAllowAgents: value.subagentsAllowAgents
  })
}

function OpenClawAgentSettingsTab({
  draft,
  modelOptions,
  allowAgentOptions,
  connectionConfig = null,
  fallbackWorkspace = '',
  loadingModels = false,
  saving = false,
  error,
  onDraftChange,
  onGenerateId,
  onOpenParamsDialog,
  onSave,
  onReload
}: OpenClawAgentSettingsTabProps): React.JSX.Element {
  const { t } = useAppI18n()
  const fields = useMemo(
    () =>
      buildAgentsCenterSettingsFormFields({
        t,
        modelOptions,
        allowAgentOptions,
        loadingModels,
        connectionConfig,
        fallbackWorkspace,
        onGenerateId,
        onOpenParamsDialog
      }),
    [
      allowAgentOptions,
      connectionConfig,
      fallbackWorkspace,
      loadingModels,
      modelOptions,
      onGenerateId,
      onOpenParamsDialog,
      t
    ]
  )
  const formLayout = useMemo(() => buildAgentsCenterSettingsFormLayout(t), [t])
  const componentMap = useMemo(() => createAgentsCenterSettingsFormComponentMap(), [])

  const formEngine = useDynamicFormEngine<OpenClawAgentSettingsDraft>({
    fields,
    layout: formLayout,
    schema: AGENTS_CENTER_SETTINGS_FORM_SCHEMA,
    schemaDefaultValues: createEmptyOpenClawAgentSettingsDraft(),
    defaultValues: draft,
    componentMap
  })

  useEffect(() => {
    const current = formEngine.form.getValues()
    if (toComparableDraft(current) === toComparableDraft(draft)) {
      return
    }

    formEngine.form.reset(draft)
  }, [draft, formEngine.form])

  useEffect(() => {
    const subscription = formEngine.form.watch((values) => {
      onDraftChange(
        (values as OpenClawAgentSettingsDraft | undefined) ??
          createEmptyOpenClawAgentSettingsDraft()
      )
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [formEngine.form, onDraftChange])

  const handleSave = (): void => {
    const validationResult = formEngine.runValidation()
    if (!validationResult.success) {
      return
    }

    onSave(validationResult.data)
  }
  const saveButtonLabel = saving ? t('agents.settings.saveBusy') : t('agents.settings.save')

  return (
    <section className="flex h-full min-h-0 flex-col">
      {error ? (
        <div className="shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      {formEngine.formErrors.length > 0 ? (
        <div className="shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {formEngine.formErrors.join('\n')}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <DynamicFormRenderer
          engine={formEngine}
          componentMap={componentMap}
          className="space-y-4"
          rowClassName="flex-wrap xl:flex-nowrap"
        />
      </div>

      <footer className="flex h-[56px] shrink-0 items-center justify-start gap-2 border-t border-black/6 px-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-[0.65rem] text-primary hover:bg-primary/8 hover:text-primary"
          aria-label={saveButtonLabel}
          title={saveButtonLabel}
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-[0.65rem] text-muted-foreground hover:bg-black/5 hover:text-foreground"
          aria-label={t('agents.settings.reload')}
          title={t('agents.settings.reload')}
          disabled={saving}
          onClick={onReload}
        >
          <RefreshCcw className="size-3.5" />
        </Button>
      </footer>
    </section>
  )
}

export default OpenClawAgentSettingsTab
