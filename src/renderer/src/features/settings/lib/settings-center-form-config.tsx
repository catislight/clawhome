import OpenClawDynamicFormModelRefConfigAction from '@/features/settings/components/dynamic-form-fields/openclaw-dynamic-form-model-ref-config-action'
import OpenClawDynamicFormModelsCatalogAddAction from '@/features/settings/components/dynamic-form-fields/openclaw-dynamic-form-models-catalog-add-action'
import type {
  InstanceGlobalConfigCategoryId,
  OpenClawInstanceGlobalConfigDraft
} from '@/features/settings/lib/openclaw-instance-global-config-types'
import type { AppI18nKey } from '@/shared/i18n/app-i18n'
import type { DynamicFormField, DynamicFormLayoutGroup } from '@/shared/lib/dynamic-form-engine'

type SettingsTranslator = (
  key: AppI18nKey,
  params?: Record<string, string | number | null | undefined>
) => string

type BuildSettingsCenterFieldsParams = {
  modelOptions: string[]
  t: SettingsTranslator
}

function toUniqueTrimmedStrings(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    )
  )
}

function createModelPrimaryOptions(
  modelOptions: string[],
  t: SettingsTranslator
): Array<{ value: string; label: string }> {
  return [
    { value: '', label: t('settings.common.unset') },
    ...modelOptions.map((model) => ({ value: model, label: model }))
  ]
}

function createToolProfileOptions(t: SettingsTranslator): Array<{ value: string; label: string }> {
  return [
    { value: '', label: t('settings.common.unset') },
    { value: 'minimal', label: t('settings.option.toolsProfile.minimal') },
    { value: 'coding', label: t('settings.option.toolsProfile.coding') },
    { value: 'messaging', label: t('settings.option.toolsProfile.messaging') },
    { value: 'full', label: t('settings.option.toolsProfile.full') }
  ]
}

function createExecHostOptions(t: SettingsTranslator): Array<{ value: string; label: string }> {
  return [
    { value: '', label: t('settings.common.unset') },
    { value: 'sandbox', label: t('settings.option.execHost.sandbox') },
    { value: 'gateway', label: t('settings.option.execHost.gateway') },
    { value: 'node', label: t('settings.option.execHost.node') }
  ]
}

function createExecSecurityOptions(t: SettingsTranslator): Array<{ value: string; label: string }> {
  return [
    { value: '', label: t('settings.common.unset') },
    { value: 'deny', label: t('settings.option.execSecurity.deny') },
    { value: 'allowlist', label: t('settings.option.execSecurity.allowlist') },
    { value: 'full', label: t('settings.option.execSecurity.full') }
  ]
}

function createExecAskOptions(t: SettingsTranslator): Array<{ value: string; label: string }> {
  return [
    { value: '', label: t('settings.common.unset') },
    { value: 'off', label: t('settings.option.execAsk.off') },
    { value: 'on-miss', label: t('settings.option.execAsk.onMiss') },
    { value: 'always', label: t('settings.option.execAsk.always') }
  ]
}

export function buildSettingsCenterFormLayout(t: SettingsTranslator): DynamicFormLayoutGroup[] {
  return [
    {
      group: t('settings.form.group.basic'),
      rows: [
        { rowKey: 'basic-r1', fields: ['agentsDefaults.workspace'] },
        { rowKey: 'basic-r2', fields: ['agentsDefaults.repoRoot'] }
      ]
    },
    {
      group: t('settings.form.group.model'),
      rows: [
        { rowKey: 'model-r1', fields: ['agentsDefaults.modelPrimary'] },
        { rowKey: 'model-r2', fields: ['agentsDefaults.modelFallbacks'] },
        { rowKey: 'model-r3', fields: ['agentsDefaults.models'] }
      ]
    },
    {
      group: t('settings.form.group.modelAdvanced'),
      rows: [
        {
          rowKey: 'model-extend-r1',
          fields: ['agentsDefaults.imageModel', 'agentsDefaults.pdfModel']
        },
        {
          rowKey: 'model-extend-r2',
          fields: ['agentsDefaults.contextTokens', 'agentsDefaults.maxConcurrent']
        }
      ]
    },
    {
      group: t('settings.form.group.tools'),
      rows: [
        { rowKey: 'tools-r1', fields: ['tools.profile'] },
        { rowKey: 'tools-r6', fields: ['tools.elevatedAllowFromJson'] },
        { rowKey: 'tools-r5', fields: ['tools.agentToAgentAllow'] },
        { rowKey: 'tools-r3', fields: ['tools.allow'] },
        { rowKey: 'tools-r4', fields: ['tools.deny'] }
      ]
    },
    {
      group: t('settings.form.group.execution'),
      rows: [
        { rowKey: 'exec-r1', fields: ['tools.execHost', 'tools.execSecurity', 'tools.execAsk'] },
        { rowKey: 'exec-r2', fields: ['tools.execNode'] }
      ]
    }
  ]
}

export function buildSettingsCenterCategoryGroups(
  t: SettingsTranslator
): Record<InstanceGlobalConfigCategoryId, string[]> {
  return {
    basic: [t('settings.form.group.basic')],
    model: [t('settings.form.group.model'), t('settings.form.group.modelAdvanced')],
    tools: [t('settings.form.group.tools'), t('settings.form.group.execution')]
  }
}

export function buildSettingsCenterDynamicFormSchemaFields(
  params: BuildSettingsCenterFieldsParams
): DynamicFormField<OpenClawInstanceGlobalConfigDraft>[] {
  const modelPrimaryOptions = createModelPrimaryOptions(params.modelOptions, params.t)
  const toolProfileOptions = createToolProfileOptions(params.t)
  const execHostOptions = createExecHostOptions(params.t)
  const execSecurityOptions = createExecSecurityOptions(params.t)
  const execAskOptions = createExecAskOptions(params.t)

  return [
    {
      id: 'agentsDefaults.workspace',
      metadata: {
        label: params.t('settings.form.workspace.label'),
        desc: params.t('settings.form.workspace.desc')
      },
      render: 'input'
    },
    {
      id: 'agentsDefaults.repoRoot',
      metadata: {
        label: params.t('settings.form.repoRoot.label'),
        desc: params.t('settings.form.repoRoot.desc')
      },
      render: 'input'
    },
    {
      id: 'agentsDefaults.modelPrimary',
      metadata: {
        label: params.t('settings.form.modelPrimary.label'),
        desc: params.t('settings.form.modelPrimary.desc')
      },
      render: 'select',
      props: {
        options: modelPrimaryOptions,
        placeholder: params.t('settings.form.modelPrimary.placeholder')
      }
    },
    {
      id: 'agentsDefaults.modelFallbacks',
      metadata: {
        label: params.t('settings.form.modelFallbacks.label'),
        desc: params.t('settings.form.modelFallbacks.desc')
      },
      render: 'modelFallbacksEditor',
      props: {
        modelOptions: params.modelOptions
      },
      normalize: (value) => {
        if (!Array.isArray(value)) {
          return []
        }

        return toUniqueTrimmedStrings(value.map((entry) => String(entry)))
      }
    },
    {
      id: 'agentsDefaults.models',
      metadata: {
        label: params.t('settings.form.modelsCatalog.label'),
        desc: params.t('settings.form.modelsCatalog.desc')
      },
      action: (actionProps) => <OpenClawDynamicFormModelsCatalogAddAction {...actionProps} />,
      render: 'modelsCatalogEditor'
    },
    {
      id: 'agentsDefaults.imageModel',
      metadata: {
        label: params.t('settings.form.imageModel.label'),
        desc: params.t('settings.form.imageModel.desc')
      },
      action: (actionProps) => <OpenClawDynamicFormModelRefConfigAction {...actionProps} />,
      render: 'modelRefEditor',
      props: {
        modelOptions: params.modelOptions,
        dialogTitle: params.t('settings.form.imageModel.dialogTitle')
      }
    },
    {
      id: 'agentsDefaults.pdfModel',
      metadata: {
        label: params.t('settings.form.pdfModel.label'),
        desc: params.t('settings.form.pdfModel.desc')
      },
      action: (actionProps) => <OpenClawDynamicFormModelRefConfigAction {...actionProps} />,
      render: 'modelRefEditor',
      props: {
        modelOptions: params.modelOptions,
        dialogTitle: params.t('settings.form.pdfModel.dialogTitle')
      }
    },
    {
      id: 'agentsDefaults.contextTokens',
      metadata: {
        label: params.t('settings.form.contextTokens.label'),
        desc: params.t('settings.form.contextTokens.desc')
      },
      render: 'input'
    },
    {
      id: 'agentsDefaults.maxConcurrent',
      metadata: {
        label: params.t('settings.form.maxConcurrent.label'),
        desc: params.t('settings.form.maxConcurrent.desc')
      },
      render: 'input'
    },
    {
      id: 'tools.profile',
      metadata: {
        label: params.t('settings.form.toolsProfile.label'),
        desc: params.t('settings.form.toolsProfile.desc')
      },
      render: 'select',
      props: {
        options: toolProfileOptions,
        placeholder: params.t('settings.form.toolsProfile.placeholder')
      }
    },
    {
      id: 'tools.agentToAgentEnabled',
      metadata: {
        label: params.t('settings.form.agentToAgentEnabled.label'),
        desc: params.t('settings.form.agentToAgentEnabled.desc')
      },
      render: 'switch'
    },
    {
      id: 'tools.elevatedEnabled',
      metadata: {
        label: params.t('settings.form.elevatedEnabled.label'),
        desc: params.t('settings.form.elevatedEnabled.desc')
      },
      render: 'switch'
    },
    {
      id: 'tools.allow',
      metadata: {
        label: params.t('settings.form.toolsAllow.label'),
        desc: params.t('settings.form.toolsAllow.desc')
      },
      render: 'textareaArray',
      normalize: (value) => {
        if (!Array.isArray(value)) {
          return []
        }

        return toUniqueTrimmedStrings(value.map((entry) => String(entry)))
      }
    },
    {
      id: 'tools.deny',
      metadata: {
        label: params.t('settings.form.toolsDeny.label'),
        desc: params.t('settings.form.toolsDeny.desc')
      },
      render: 'textareaArray',
      normalize: (value) => {
        if (!Array.isArray(value)) {
          return []
        }

        return toUniqueTrimmedStrings(value.map((entry) => String(entry)))
      }
    },
    {
      id: 'tools.agentToAgentAllow',
      metadata: {
        label: params.t('settings.form.agentToAgentAllow.label'),
        desc: params.t('settings.form.agentToAgentAllow.desc')
      },
      action: {
        fieldId: 'tools.agentToAgentEnabled'
      },
      render: 'textareaArray',
      disabledWhen: ({ getValue }) => !Boolean(getValue('tools.agentToAgentEnabled')),
      normalize: (value) => {
        if (!Array.isArray(value)) {
          return []
        }

        return toUniqueTrimmedStrings(value.map((entry) => String(entry)))
      }
    },
    {
      id: 'tools.elevatedAllowFromJson',
      metadata: {
        label: params.t('settings.form.elevatedAllowFrom.label'),
        desc: params.t('settings.form.elevatedAllowFrom.desc')
      },
      action: {
        fieldId: 'tools.elevatedEnabled'
      },
      disabledWhen: ({ getValue }) => !Boolean(getValue('tools.elevatedEnabled')),
      render: 'textarea'
    },
    {
      id: 'tools.execHost',
      metadata: {
        label: params.t('settings.form.execHost.label'),
        desc: params.t('settings.form.execHost.desc')
      },
      render: 'select',
      props: {
        options: execHostOptions
      }
    },
    {
      id: 'tools.execSecurity',
      metadata: {
        label: params.t('settings.form.execSecurity.label'),
        desc: params.t('settings.form.execSecurity.desc')
      },
      render: 'select',
      props: {
        options: execSecurityOptions
      }
    },
    {
      id: 'tools.execAsk',
      metadata: {
        label: params.t('settings.form.execAsk.label'),
        desc: params.t('settings.form.execAsk.desc')
      },
      render: 'select',
      props: {
        options: execAskOptions
      }
    },
    {
      id: 'tools.execNode',
      metadata: {
        label: params.t('settings.form.execNode.label'),
        desc: params.t('settings.form.execNode.desc')
      },
      render: 'input',
      visibleWhen: ({ getValue }) => getValue('tools.execHost') === 'node'
    }
  ]
}
