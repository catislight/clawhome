export type OpenClawAgentIdentity = {
  name?: string
  theme?: string
  emoji?: string
  avatar?: string
  avatarUrl?: string
}

export type OpenClawAgentRuntime = {
  type: 'embedded' | 'acp'
  agent?: string
  backend?: string
  mode?: 'persistent' | 'oneshot'
  cwd?: string
}

export type OpenClawAgentSummary = {
  id: string
  name?: string
  identity?: OpenClawAgentIdentity
  workspace?: string
  agentDir?: string
  model?: string
  runtime?: OpenClawAgentRuntime
}

export type OpenClawAgentsListResult = {
  defaultId: string
  mainKey: string
  scope: string
  agents: OpenClawAgentSummary[]
}

export type OpenClawAgentCreatePayload = {
  name: string
  workspace?: string
  emoji?: string
  avatar?: string
}

export type OpenClawAgentFileEntry = {
  name: string
  path: string
  missing: boolean
  size?: number
  updatedAtMs?: number
  content?: string
}

export type OpenClawAgentsFilesListResult = {
  agentId: string
  workspace: string
  files: OpenClawAgentFileEntry[]
}

export type OpenClawAgentsFilesGetResult = {
  agentId: string
  workspace: string
  file: OpenClawAgentFileEntry
}

export type OpenClawModelChoice = {
  id: string
  name: string
  provider: string
  contextWindow?: number
  reasoning?: boolean
}

export type OpenClawToolCatalogProfileId = 'minimal' | 'coding' | 'messaging' | 'full'

export type OpenClawToolCatalogProfile = {
  id: OpenClawToolCatalogProfileId
  label: string
}

export type OpenClawToolCatalogEntry = {
  id: string
  label: string
  description: string
  source: 'core' | 'plugin'
  pluginId?: string
  optional?: boolean
  defaultProfiles: OpenClawToolCatalogProfileId[]
}

export type OpenClawToolCatalogGroup = {
  id: string
  label: string
  source: 'core' | 'plugin'
  pluginId?: string
  tools: OpenClawToolCatalogEntry[]
}

export type OpenClawToolsCatalogResult = {
  agentId: string
  profiles: OpenClawToolCatalogProfile[]
  groups: OpenClawToolCatalogGroup[]
}

export type OpenClawConfigSnapshot = {
  hash?: string
  config: Record<string, unknown>
}

export const OPENCLAW_AGENT_FILE_NAME_PRIORITY = [
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'HEARTBEAT.md',
  'BOOTSTRAP.md',
  'MEMORY.md',
  'MEMORIES.md'
] as const

export function buildOpenClawAgentMainSessionKey(agentId: string, mainKey: string): string {
  const normalizedAgentId = agentId.trim().toLowerCase()
  const normalizedMainKey = (mainKey.trim().toLowerCase() || 'main').replace(/:/g, '')
  return `agent:${normalizedAgentId}:${normalizedMainKey}`
}
