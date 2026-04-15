import OpenClawDynamicFormAllowAgentsField from '@/features/agents/components/dynamic-form-fields/openclaw-dynamic-form-allow-agents-field'
import OpenClawDynamicFormAvatarField from '@/features/agents/components/dynamic-form-fields/openclaw-dynamic-form-avatar-field'
import type { OpenClawAgentSettingsDraft } from '@/features/agents/lib/openclaw-agent-config-entry'
import {
  createOpenClawDynamicFormComponentMap,
  type DynamicFormComponentMap
} from '@/shared/lib/dynamic-form-engine'

export function createAgentsCenterSettingsFormComponentMap(): DynamicFormComponentMap<OpenClawAgentSettingsDraft> {
  return {
    ...createOpenClawDynamicFormComponentMap<OpenClawAgentSettingsDraft>(),
    allowAgentsSelector: OpenClawDynamicFormAllowAgentsField,
    avatarUpload: OpenClawDynamicFormAvatarField
  }
}
