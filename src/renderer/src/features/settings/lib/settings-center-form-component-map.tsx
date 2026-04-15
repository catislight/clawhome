import OpenClawDynamicFormModelFallbacksField from '@/features/settings/components/dynamic-form-fields/openclaw-dynamic-form-model-fallbacks-field'
import OpenClawDynamicFormModelsCatalogField from '@/features/settings/components/dynamic-form-fields/openclaw-dynamic-form-models-catalog-field'
import OpenClawDynamicFormModelRefField from '@/features/settings/components/dynamic-form-fields/openclaw-dynamic-form-model-ref-field'
import type { OpenClawInstanceGlobalConfigDraft } from '@/features/settings/lib/openclaw-instance-global-config-types'
import {
  createOpenClawDynamicFormComponentMap,
  type DynamicFormComponentMap
} from '@/shared/lib/dynamic-form-engine'

export function createSettingsCenterDynamicFormComponentMap(): DynamicFormComponentMap<OpenClawInstanceGlobalConfigDraft> {
  return {
    ...createOpenClawDynamicFormComponentMap<OpenClawInstanceGlobalConfigDraft>(),
    modelFallbacksEditor: OpenClawDynamicFormModelFallbacksField,
    modelsCatalogEditor: OpenClawDynamicFormModelsCatalogField,
    modelRefEditor: OpenClawDynamicFormModelRefField
  }
}
