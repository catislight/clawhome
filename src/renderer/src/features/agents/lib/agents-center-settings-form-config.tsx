import { WandSparkles } from 'lucide-react'

import type { OpenClawAgentSettingsDraft } from '@/features/agents/lib/openclaw-agent-config-entry'
import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import type { AppI18nKey } from '@/shared/i18n/app-i18n'
import { Button } from '@/shared/ui/button'
import type { DynamicFormField, DynamicFormLayoutGroup } from '@/shared/lib/dynamic-form-engine'

type BuildAgentsCenterSettingsFieldsParams = {
  t: (key: AppI18nKey, params?: Record<string, string | number | null | undefined>) => string
  modelOptions: string[]
  allowAgentOptions: string[]
  loadingModels: boolean
  connectionConfig?: SshConnectionFormValues | null
  fallbackWorkspace?: string
  onGenerateId: () => void
  onOpenParamsDialog: () => void
}

type SelectOption = {
  value: string
  label: string
}

function createModelOptions(
  modelOptions: string[],
  loadingModels: boolean,
  t: BuildAgentsCenterSettingsFieldsParams['t']
): SelectOption[] {
  const defaultLabel = loadingModels
    ? t('agents.form.model.placeholderLoading')
    : t('agents.form.model.placeholderUnset')
  return [
    { value: '', label: defaultLabel },
    ...modelOptions.map((model) => ({ value: model, label: model }))
  ]
}

export function buildAgentsCenterSettingsFormLayout(
  t: BuildAgentsCenterSettingsFieldsParams['t']
): DynamicFormLayoutGroup[] {
  return [
    {
      group: t('agents.form.group.basic'),
      rows: [
        { rowKey: 'basic-r1', fields: ['id', 'default'] },
        { rowKey: 'basic-r2', fields: ['name', 'workspace'] },
        { rowKey: 'basic-r3', fields: ['emoji', 'avatar'] },
        { rowKey: 'basic-r4', fields: ['agentDir'] }
      ]
    },
    {
      group: t('agents.form.group.model'),
      rows: [
        { rowKey: 'model-r1', fields: ['model'] },
        { rowKey: 'model-r2', fields: ['paramsJson'] }
      ]
    },
    {
      group: t('agents.form.group.collaboration'),
      rows: [{ rowKey: 'collab-r1', fields: ['subagentsAllowAgents'] }]
    }
  ]
}

export function buildAgentsCenterSettingsFormFields(
  params: BuildAgentsCenterSettingsFieldsParams
): DynamicFormField<OpenClawAgentSettingsDraft>[] {
  const modelOptions = createModelOptions(params.modelOptions, params.loadingModels, params.t)

  return [
    {
      id: 'id',
      metadata: {
        label: params.t('agents.form.id.label'),
        desc: params.t('agents.form.id.desc')
      },
      render: 'input',
      action: (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-[0.65rem] text-sky-600 hover:bg-sky-50 hover:text-sky-700"
          aria-label={params.t('agents.form.id.generate')}
          title={params.t('agents.form.id.generate')}
          onClick={params.onGenerateId}
        >
          <WandSparkles className="size-3.5" />
        </Button>
      )
    },
    {
      id: 'default',
      metadata: {
        label: params.t('agents.form.default.label'),
        desc: params.t('agents.form.default.desc')
      },
      render: 'switch'
    },
    {
      id: 'name',
      metadata: {
        label: params.t('agents.form.name.label'),
        desc: params.t('agents.form.name.desc')
      },
      render: 'input'
    },
    {
      id: 'workspace',
      metadata: {
        label: params.t('agents.form.workspace.label'),
        desc: params.t('agents.form.workspace.desc')
      },
      render: 'input'
    },
    {
      id: 'emoji',
      metadata: {
        label: params.t('agents.form.emoji.label'),
        desc: params.t('agents.form.emoji.desc')
      },
      render: 'input',
      props: {
        placeholder: params.t('agents.form.emoji.placeholder')
      }
    },
    {
      id: 'avatar',
      metadata: {
        label: params.t('agents.form.avatar.label'),
        desc: params.t('agents.form.avatar.desc')
      },
      render: 'avatarUpload',
      props: {
        workspaceFieldId: 'workspace',
        fallbackWorkspace: params.fallbackWorkspace,
        connectionConfig: params.connectionConfig
      }
    },
    {
      id: 'agentDir',
      metadata: {
        label: params.t('agents.form.agentDir.label'),
        desc: params.t('agents.form.agentDir.desc')
      },
      render: 'input'
    },
    {
      id: 'model',
      metadata: {
        label: params.t('agents.form.model.label'),
        desc: params.t('agents.form.model.desc')
      },
      render: 'select',
      disabledWhen: () => params.loadingModels,
      props: {
        options: modelOptions,
        placeholder: params.loadingModels
          ? params.t('agents.form.model.placeholderLoading')
          : params.t('agents.form.model.placeholderUnset')
      },
      action: (
        <Button
          type="button"
          variant="ghost"
          className="h-8 rounded-[0.7rem] px-1.5 text-xs text-sky-600 hover:bg-sky-50 hover:text-sky-700"
          onClick={params.onOpenParamsDialog}
        >
          {params.t('agents.form.model.configureParams')}
        </Button>
      )
    },
    {
      id: 'subagentsAllowAgents',
      metadata: {
        label: params.t('agents.form.allowAgents.label'),
        desc: params.t('agents.form.allowAgents.desc')
      },
      render: 'allowAgentsSelector',
      props: {
        options: params.allowAgentOptions
      }
    },
    {
      id: 'paramsJson',
      metadata: {
        label: params.t('agents.form.paramsJson.label'),
        desc: params.t('agents.form.paramsJson.desc')
      },
      visibleWhen: () => false,
      render: 'textarea'
    }
  ]
}
