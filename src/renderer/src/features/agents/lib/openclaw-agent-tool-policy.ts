import type {
  OpenClawToolCatalogEntry,
  OpenClawToolCatalogProfileId
} from '@/features/agents/lib/openclaw-agents-types'
import { isRecord } from '@/features/agents/lib/openclaw-agent-config-entry'

export type OpenClawAgentToolPolicy = {
  profile: OpenClawToolCatalogProfileId
  profileInherited: boolean
  hasAllowlist: boolean
  allow: string[]
  alsoAllow: string[]
  deny: string[]
}

function normalizePolicyToken(value: string): string {
  return value.trim().toLowerCase()
}

function dedupeTokens(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizePolicyToken).filter((value) => value.length > 0)))
}

function readProfileId(value: unknown): OpenClawToolCatalogProfileId | null {
  if (value === 'minimal' || value === 'coding' || value === 'messaging' || value === 'full') {
    return value
  }
  return null
}

function readPolicyList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return dedupeTokens(value.filter((entry): entry is string => typeof entry === 'string'))
}

function matchToolPattern(toolId: string, pattern: string): boolean {
  const normalizedPattern = normalizePolicyToken(pattern)
  if (!normalizedPattern) {
    return false
  }

  if (normalizedPattern === '*') {
    return true
  }

  if (!normalizedPattern.includes('*')) {
    return normalizePolicyToken(toolId) === normalizedPattern
  }

  const escaped = normalizedPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  try {
    return new RegExp(`^${escaped}$`, 'i').test(toolId.trim())
  } catch {
    return false
  }
}

function matchesList(toolId: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchToolPattern(toolId, pattern))
}

function resolveBaseProfileAllowance(
  tool: OpenClawToolCatalogEntry,
  profile: OpenClawToolCatalogProfileId
): boolean {
  if (profile === 'full') {
    // Official config semantics: "full" means no base restriction.
    // Optional tools still require explicit opt-in.
    return tool.optional !== true
  }

  return tool.defaultProfiles.includes(profile)
}

export function buildAgentToolPolicy(params: {
  config: Record<string, unknown>
  agentEntry: Record<string, unknown> | null
}): OpenClawAgentToolPolicy {
  const globalTools = isRecord(params.config.tools) ? params.config.tools : {}
  const agentTools = isRecord(params.agentEntry?.tools) ? params.agentEntry.tools : {}
  const agentProfile = readProfileId(agentTools.profile)
  const globalProfile = readProfileId(globalTools.profile)

  return {
    profile: agentProfile ?? globalProfile ?? ('full' as const),
    profileInherited: agentProfile === null,
    hasAllowlist: readPolicyList(agentTools.allow).length > 0,
    allow: readPolicyList(agentTools.allow),
    alsoAllow: readPolicyList(agentTools.alsoAllow),
    deny: readPolicyList(agentTools.deny)
  }
}

export function resolveToolEnabled(params: {
  tool: OpenClawToolCatalogEntry
  policy: OpenClawAgentToolPolicy
}): boolean {
  const { tool, policy } = params
  const denied = matchesList(tool.id, policy.deny)

  if (policy.hasAllowlist) {
    return matchesList(tool.id, policy.allow) && !denied
  }

  const baseAllowed = resolveBaseProfileAllowance(tool, policy.profile)
  const extraAllowed = matchesList(tool.id, policy.alsoAllow)
  return (baseAllowed || extraAllowed) && !denied
}

export function toggleToolInPolicy(params: {
  tool: OpenClawToolCatalogEntry
  policy: OpenClawAgentToolPolicy
  enabled: boolean
}): OpenClawAgentToolPolicy {
  const normalizedToolId = normalizePolicyToken(params.tool.id)
  const nextAllow = new Set(params.policy.allow.map(normalizePolicyToken))
  const nextAlsoAllow = new Set(params.policy.alsoAllow.map(normalizePolicyToken))
  const nextDeny = new Set(params.policy.deny.map(normalizePolicyToken))

  if (params.policy.hasAllowlist) {
    if (params.enabled) {
      nextAllow.add(normalizedToolId)
      nextDeny.delete(normalizedToolId)
    } else {
      nextAllow.delete(normalizedToolId)
      nextDeny.delete(normalizedToolId)
    }
  } else {
    const baseAllowed = resolveBaseProfileAllowance(params.tool, params.policy.profile)
    if (params.enabled) {
      nextDeny.delete(normalizedToolId)
      if (!baseAllowed) {
        nextAlsoAllow.add(normalizedToolId)
      }
    } else {
      nextAlsoAllow.delete(normalizedToolId)
      nextDeny.add(normalizedToolId)
    }
  }

  return {
    ...params.policy,
    allow: Array.from(nextAllow),
    alsoAllow: Array.from(nextAlsoAllow),
    deny: Array.from(nextDeny)
  }
}

export function applyToolPolicyToAgentEntry(params: {
  agentEntry: Record<string, unknown>
  policy: OpenClawAgentToolPolicy
}): Record<string, unknown> {
  const nextEntry = { ...params.agentEntry }
  const tools = isRecord(nextEntry.tools) ? { ...nextEntry.tools } : {}

  if (params.policy.hasAllowlist) {
    if (params.policy.allow.length > 0) {
      tools.allow = params.policy.allow
    } else {
      delete tools.allow
    }
    delete tools.alsoAllow
  } else {
    delete tools.allow
    if (params.policy.alsoAllow.length > 0) {
      tools.alsoAllow = params.policy.alsoAllow
    } else {
      delete tools.alsoAllow
    }
  }

  if (params.policy.deny.length > 0) {
    tools.deny = params.policy.deny
  } else {
    delete tools.deny
  }

  if (Object.keys(tools).length === 0) {
    delete nextEntry.tools
  } else {
    nextEntry.tools = tools
  }

  return nextEntry
}
