import { isRecord } from '@/features/agents/lib/openclaw-agent-config-entry'

function normalizeSkillKey(value: string): string {
  return value.trim()
}

function dedupeSkillKeys(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeSkillKey).filter((value) => value.length > 0)))
}

function readSkillAllowlist(entry: Record<string, unknown> | null): string[] | null {
  if (!entry || !Array.isArray(entry.skills)) {
    return null
  }

  const values = dedupeSkillKeys(
    entry.skills.filter((value): value is string => typeof value === 'string')
  )
  return values
}

export function resolveSkillEnabled(params: {
  agentEntry: Record<string, unknown> | null
  skillName: string
}): boolean {
  const allowlist = readSkillAllowlist(params.agentEntry)
  if (allowlist === null) {
    return true
  }

  const normalized = normalizeSkillKey(params.skillName)
  return allowlist.includes(normalized)
}

export function toggleSkillAllowlist(params: {
  agentEntry: Record<string, unknown>
  allSkillNames: string[]
  skillName: string
  enabled: boolean
}): Record<string, unknown> {
  const nextEntry = { ...params.agentEntry }
  const normalizedSkillName = normalizeSkillKey(params.skillName)
  const allSkillNames = dedupeSkillKeys(params.allSkillNames)
  const allowlist = readSkillAllowlist(params.agentEntry)

  if (allowlist === null) {
    if (params.enabled) {
      return nextEntry
    }

    nextEntry.skills = allSkillNames.filter((name) => name !== normalizedSkillName)
    return nextEntry
  }

  const nextAllowlist = new Set(allowlist)
  if (params.enabled) {
    nextAllowlist.add(normalizedSkillName)
  } else {
    nextAllowlist.delete(normalizedSkillName)
  }

  if (nextAllowlist.size === allSkillNames.length) {
    delete nextEntry.skills
    return nextEntry
  }

  nextEntry.skills = Array.from(nextAllowlist)
  return nextEntry
}

export function readAgentSubagentsAllowAgents(entry: Record<string, unknown> | null): string[] {
  const subagents = isRecord(entry?.subagents) ? entry.subagents : null
  if (!subagents || !Array.isArray(subagents.allowAgents)) {
    return []
  }

  return dedupeSkillKeys(
    subagents.allowAgents.filter((value): value is string => typeof value === 'string')
  )
}
