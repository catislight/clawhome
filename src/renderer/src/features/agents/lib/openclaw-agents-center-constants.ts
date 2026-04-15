import type { OpenClawAgentSettingsDraft } from '@/features/agents/lib/openclaw-agent-config-entry'
import type {
  OpenClawAgentTabId,
  OpenClawToolProfilePresetId
} from '@/features/agents/lib/openclaw-agents-center-types'

export const OPENCLAW_AGENT_PERSONA_FILE_NAMES: string[] = [
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'HEARTBEAT.md'
]

export const OPENCLAW_AGENT_TAB_ITEMS: OpenClawAgentTabId[] = [
  'persona',
  'memory',
  'tools',
  'skills',
  'settings'
]

export const OPENCLAW_TOOL_PROFILE_PRESET_IDS: OpenClawToolProfilePresetId[] = [
  'minimal',
  'coding',
  'messaging',
  'full',
  'inherit'
]

export function createEmptyOpenClawAgentSettingsDraft(): OpenClawAgentSettingsDraft {
  return {
    id: '',
    default: false,
    name: '',
    emoji: '',
    avatar: '',
    workspace: '',
    agentDir: '',
    model: '',
    paramsJson: '',
    subagentsAllowAgents: []
  }
}
