import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  getOpenClawConfigSnapshot,
  setOpenClawConfigSnapshot
} from '@/features/agents/lib/openclaw-agents-api'
import { useOpenClawModelChoices } from '@/features/agents/lib/use-openclaw-model-choices'
import { useWorkspaceInstanceSelection } from '@/features/instances/lib/use-workspace-instance-selection'
import type { OpenClawInstance } from '@/features/instances/store/use-app-store'
import { useAppStore } from '@/features/instances/store/use-app-store'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import {
  buildConfigFromDraft,
  buildDraftFromConfigSnapshot
} from '@/features/settings/lib/openclaw-instance-global-config-draft'
import {
  buildInstanceGlobalConfigCategories,
  INSTANCE_GLOBAL_CONFIG_CATEGORY_IDS,
  type InstanceGlobalConfigCategory,
  type InstanceGlobalConfigCategoryId,
  type OpenClawInstanceGlobalConfigDraft
} from '@/features/settings/lib/openclaw-instance-global-config-types'
import {
  buildSettingsCenterCategoryGroups,
  buildSettingsCenterDynamicFormSchemaFields,
  buildSettingsCenterFormLayout
} from '@/features/settings/lib/settings-center-form-config'
import { createSettingsCenterDynamicFormComponentMap } from '@/features/settings/lib/settings-center-form-component-map'
import { SETTINGS_CENTER_FORM_SCHEMA } from '@/features/settings/lib/settings-center-form-schema'
import {
  useDynamicFormEngine,
  type DynamicFormEngineResult
} from '@/shared/lib/dynamic-form-engine'

const EMPTY_DRAFT: OpenClawInstanceGlobalConfigDraft = buildDraftFromConfigSnapshot({
  config: {}
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function buildModelOptions(params: {
  draft: OpenClawInstanceGlobalConfigDraft
  modelChoices: Array<{ id: string }>
}): string[] {
  const values = new Set<string>()

  for (const model of params.modelChoices) {
    const normalized = model.id.trim()
    if (normalized) {
      values.add(normalized)
    }
  }

  for (const ref of Object.keys(params.draft.agentsDefaults.models)) {
    const normalized = ref.trim()
    if (normalized) {
      values.add(normalized)
    }
  }

  for (const ref of [
    params.draft.agentsDefaults.modelPrimary,
    params.draft.agentsDefaults.imageModel?.primary,
    params.draft.agentsDefaults.pdfModel?.primary
  ]) {
    const normalized = ref?.trim() ?? ''
    if (normalized) {
      values.add(normalized)
    }
  }

  for (const ref of params.draft.agentsDefaults.modelFallbacks) {
    const normalized = ref.trim()
    if (normalized) {
      values.add(normalized)
    }
  }

  for (const ref of params.draft.agentsDefaults.imageModel?.fallbacks ?? []) {
    const normalized = ref.trim()
    if (normalized) {
      values.add(normalized)
    }
  }

  for (const ref of params.draft.agentsDefaults.pdfModel?.fallbacks ?? []) {
    const normalized = ref.trim()
    if (normalized) {
      values.add(normalized)
    }
  }

  return Array.from(values).sort((a, b) => a.localeCompare(b))
}

export type SettingsCenterController = {
  categories: InstanceGlobalConfigCategory[]
  instances: OpenClawInstance[]
  selectedInstance: OpenClawInstance | null
  selectedInstanceConnected: boolean
  selectedInstanceRequiresConnectionConfig: boolean
  gatewayInstanceId: string | null
  reconnectingInstanceId: string | null
  setReconnectingInstanceId: (value: string | null) => void

  activeCategory: InstanceGlobalConfigCategory
  activeCategoryId: InstanceGlobalConfigCategoryId
  changeCategory: (categoryId: InstanceGlobalConfigCategoryId) => void

  configLoading: boolean
  configSaving: boolean
  configError: string | null

  jsonMode: boolean
  jsonDraft: string
  jsonSaving: boolean
  jsonError: string | null
  setJsonDraft: (value: string) => void
  openJsonEditor: () => void
  saveJson: () => Promise<void>

  saveConfig: () => Promise<void>
  loadSnapshot: () => Promise<void>

  modelChoicesError: string | null
  visibleGroupIds: string[]

  formEngine: DynamicFormEngineResult<OpenClawInstanceGlobalConfigDraft>
  formComponentMap: ReturnType<typeof createSettingsCenterDynamicFormComponentMap>
}

export function useSettingsCenterController(): SettingsCenterController {
  const { t } = useAppI18n()
  const instances = useAppStore((state) => state.instances)
  const { selectedInstance } = useWorkspaceInstanceSelection()

  const [activeCategoryId, setActiveCategoryId] = useState<InstanceGlobalConfigCategoryId>('basic')
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [snapshotHash, setSnapshotHash] = useState<string | undefined>(undefined)
  const [snapshotConfig, setSnapshotConfig] = useState<Record<string, unknown>>({})
  const [reconnectingInstanceId, setReconnectingInstanceId] = useState<string | null>(null)
  const [jsonMode, setJsonMode] = useState(false)
  const [jsonDraft, setJsonDraft] = useState('{}')
  const [jsonSaving, setJsonSaving] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [currentFormDraft, setCurrentFormDraft] = useState<OpenClawInstanceGlobalConfigDraft>(EMPTY_DRAFT)

  const selectedInstanceConnected = selectedInstance?.connectionState === 'connected'
  const selectedInstanceRequiresConnectionConfig =
    Boolean(selectedInstance) && selectedInstance?.connectionConfig === null
  const gatewayInstanceId = selectedInstanceConnected && selectedInstance ? selectedInstance.id : null

  const modelChoices = useOpenClawModelChoices({
    instanceId: gatewayInstanceId,
    enabled: selectedInstanceConnected
  })

  const modelOptions = useMemo(
    () =>
      buildModelOptions({
        draft: currentFormDraft,
        modelChoices: modelChoices.models
      }),
    [currentFormDraft, modelChoices.models]
  )

  const dynamicFields = useMemo(
    () =>
      buildSettingsCenterDynamicFormSchemaFields({
        modelOptions,
        t
      }),
    [modelOptions, t]
  )
  const categories = useMemo(() => buildInstanceGlobalConfigCategories(t), [t])
  const categoryGroups = useMemo(() => buildSettingsCenterCategoryGroups(t), [t])
  const formLayout = useMemo(() => buildSettingsCenterFormLayout(t), [t])
  const formComponentMap = useMemo(() => createSettingsCenterDynamicFormComponentMap(), [])

  const formEngine = useDynamicFormEngine<OpenClawInstanceGlobalConfigDraft>({
    fields: dynamicFields,
    layout: formLayout,
    schema: SETTINGS_CENTER_FORM_SCHEMA,
    schemaDefaultValues: EMPTY_DRAFT,
    componentMap: formComponentMap,
  })

  useEffect(() => {
    const subscription = formEngine.form.watch((values) => {
      setCurrentFormDraft((values as OpenClawInstanceGlobalConfigDraft | undefined) ?? EMPTY_DRAFT)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [formEngine.form])

  const applyDraftToForm = useCallback(
    (nextDraft: OpenClawInstanceGlobalConfigDraft): void => {
      formEngine.form.reset(nextDraft)
      setCurrentFormDraft(nextDraft)
    },
    [formEngine.form]
  )

  const loadSnapshot = useCallback(async (): Promise<void> => {
    if (!gatewayInstanceId) {
      return
    }

    setConfigLoading(true)
    setConfigError(null)

    try {
      const snapshot = await getOpenClawConfigSnapshot(gatewayInstanceId)
      const nextDraft = buildDraftFromConfigSnapshot(snapshot)

      setSnapshotHash(snapshot.hash)
      setSnapshotConfig(snapshot.config)
      applyDraftToForm(nextDraft)
    } catch (error) {
      setConfigError(
        error instanceof Error ? error.message : t('settings.error.loadConfigFailed')
      )
    } finally {
      setConfigLoading(false)
    }
  }, [applyDraftToForm, gatewayInstanceId, t])

  useEffect(() => {
    if (!gatewayInstanceId) {
      setConfigError(null)
      setConfigLoading(false)
      setConfigSaving(false)
      setJsonSaving(false)
      setJsonMode(false)
      setJsonDraft('{}')
      setJsonError(null)
      setSnapshotHash(undefined)
      setSnapshotConfig({})
      applyDraftToForm(EMPTY_DRAFT)
      return
    }

    void loadSnapshot()
  }, [applyDraftToForm, gatewayInstanceId, loadSnapshot])

  const saveConfig = useCallback(async (): Promise<void> => {
    if (!gatewayInstanceId) {
      return
    }

    const validationResult = formEngine.runValidation()
    if (!validationResult.success) {
      setConfigError(t('settings.error.formValidationFailed'))
      return
    }

    setConfigSaving(true)
    setConfigError(null)

    try {
      const nextConfig = buildConfigFromDraft({
        baseConfig: snapshotConfig,
        draft: validationResult.data
      })

      await setOpenClawConfigSnapshot(gatewayInstanceId, {
        config: nextConfig,
        baseHash: snapshotHash
      })

      await loadSnapshot()
    } catch (error) {
      setConfigError(
        error instanceof Error ? error.message : t('settings.error.saveConfigFailed')
      )
    } finally {
      setConfigSaving(false)
    }
  }, [formEngine, gatewayInstanceId, loadSnapshot, snapshotConfig, snapshotHash, t])

  const openJsonEditor = useCallback((): void => {
    let serialized = '{}'
    try {
      serialized = JSON.stringify(snapshotConfig, null, 2)
    } catch {
      serialized = '{}'
    }

    setJsonDraft(serialized)
    setJsonError(null)
    setJsonMode(true)
  }, [snapshotConfig])

  const saveJson = useCallback(async (): Promise<void> => {
    if (!gatewayInstanceId) {
      return
    }

    let parsedConfig: unknown
    try {
      parsedConfig = JSON.parse(jsonDraft)
    } catch {
      setJsonError(t('settings.error.jsonParseFailed'))
      return
    }

    if (!isRecord(parsedConfig)) {
      setJsonError(t('settings.error.jsonRootMustBeObject'))
      return
    }

    setJsonSaving(true)
    setJsonError(null)
    setConfigError(null)

    try {
      await setOpenClawConfigSnapshot(gatewayInstanceId, {
        config: parsedConfig,
        baseHash: snapshotHash
      })
      await loadSnapshot()
      setJsonDraft(JSON.stringify(parsedConfig, null, 2))
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : t('settings.error.saveJsonFailed'))
    } finally {
      setJsonSaving(false)
    }
  }, [gatewayInstanceId, jsonDraft, loadSnapshot, snapshotHash, t])

  const activeCategory = useMemo(
    () =>
      categories.find((category) => category.id === activeCategoryId) ??
      categories[0] ?? {
        id: INSTANCE_GLOBAL_CONFIG_CATEGORY_IDS[0],
        label: '',
        description: ''
      },
    [activeCategoryId, categories]
  )

  const visibleGroupIds = useMemo(
    () => categoryGroups[activeCategoryId] ?? [],
    [activeCategoryId, categoryGroups]
  )

  const changeCategory = useCallback((categoryId: InstanceGlobalConfigCategoryId) => {
    setJsonMode(false)
    setJsonError(null)
    setActiveCategoryId(categoryId)
  }, [])

  return {
    categories,
    instances,
    selectedInstance,
    selectedInstanceConnected,
    selectedInstanceRequiresConnectionConfig,
    gatewayInstanceId,
    reconnectingInstanceId,
    setReconnectingInstanceId,

    activeCategory,
    activeCategoryId,
    changeCategory,

    configLoading,
    configSaving,
    configError,

    jsonMode,
    jsonDraft,
    jsonSaving,
    jsonError,
    setJsonDraft,
    openJsonEditor,
    saveJson,

    saveConfig,
    loadSnapshot,

    modelChoicesError: modelChoices.error,
    visibleGroupIds,

    formEngine,
    formComponentMap
  }
}
