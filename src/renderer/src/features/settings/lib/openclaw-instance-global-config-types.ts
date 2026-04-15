import type { AppI18nKey } from '@/shared/i18n/app-i18n'

export type InstanceGlobalConfigCategoryId = 'basic' | 'model' | 'tools'

export type InstanceGlobalConfigCategory = {
  id: InstanceGlobalConfigCategoryId
  label: string
  description: string
}

type SettingsTranslator = (
  key: AppI18nKey,
  params?: Record<string, string | number | null | undefined>
) => string

export const INSTANCE_GLOBAL_CONFIG_CATEGORY_IDS: InstanceGlobalConfigCategoryId[] = [
  'basic',
  'model',
  'tools'
]

export function buildInstanceGlobalConfigCategories(
  t: SettingsTranslator
): InstanceGlobalConfigCategory[] {
  return [
    {
      id: 'basic',
      label: t('settings.category.basic.label'),
      description: t('settings.category.basic.description')
    },
    {
      id: 'model',
      label: t('settings.category.model.label'),
      description: t('settings.category.model.description')
    },
    {
      id: 'tools',
      label: t('settings.category.tools.label'),
      description: t('settings.category.tools.description')
    }
  ]
}

export type OpenClawModelRefDraft = {
  primary: string
  fallbacks: string[]
}

export type OpenClawModelEntryDraft = {
  alias?: string
  params?: Record<string, unknown>
}

export type OpenClawAgentDefaultsDraft = {
  workspace: string
  repoRoot: string
  modelPrimary: string
  modelFallbacks: string[]
  models: Record<string, OpenClawModelEntryDraft>
  imageModel: OpenClawModelRefDraft | null
  pdfModel: OpenClawModelRefDraft | null
  contextTokens: string
  maxConcurrent: string
}

export type OpenClawToolsDraft = {
  profile: string
  allow: string[]
  deny: string[]
  agentToAgentEnabled: boolean
  agentToAgentAllow: string[]
  elevatedEnabled: boolean
  elevatedAllowFromJson: string
  execHost: '' | 'sandbox' | 'gateway' | 'node'
  execSecurity: '' | 'deny' | 'allowlist' | 'full'
  execAsk: '' | 'off' | 'on-miss' | 'always'
  execNode: string
}

export type OpenClawInstanceGlobalConfigDraft = {
  agentsDefaults: OpenClawAgentDefaultsDraft
  tools: OpenClawToolsDraft
}

export type ModelEntryDialogPayload = {
  ref: string
  alias: string
  paramsText: string
}

export type ModelRefDialogPayload = {
  primary: string
  fallbacks: string[]
}
