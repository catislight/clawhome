import type { OpenClawAgentSummary } from '@/features/agents/lib/openclaw-agents-types'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

export type OpenClawAgentSettingsDraft = {
  id: string
  default: boolean
  name: string
  emoji: string
  avatar: string
  workspace: string
  agentDir: string
  model: string
  paramsJson: string
  subagentsAllowAgents: string[]
}

export type FoundAgentEntry = {
  index: number
  entry: Record<string, unknown> | null
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function readTrimmedString(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function normalizeModelPrimary(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (!isRecord(value)) {
    return ''
  }

  return readTrimmedString(value.primary)
}

export function findAgentEntry(config: Record<string, unknown>, agentId: string): FoundAgentEntry {
  const normalizedAgentId = agentId.trim().toLowerCase()
  const agents = isRecord(config.agents) ? config.agents : null
  const list = Array.isArray(agents?.list) ? agents.list : []

  for (let index = 0; index < list.length; index += 1) {
    const entry = list[index]
    if (!isRecord(entry)) {
      continue
    }
    if (readTrimmedString(entry.id).toLowerCase() === normalizedAgentId) {
      return {
        index,
        entry
      }
    }
  }

  return {
    index: -1,
    entry: null
  }
}

function toJsonText(value: unknown): string {
  if (value === undefined) {
    return ''
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

export function buildAgentSettingsDraft(params: {
  entry: Record<string, unknown> | null
  summary: OpenClawAgentSummary | null
}): OpenClawAgentSettingsDraft {
  const entry = params.entry
  const summary = params.summary
  const subagents = isRecord(entry?.subagents) ? entry.subagents : null
  const identity = isRecord(entry?.identity) ? entry.identity : null

  return {
    id: readTrimmedString(entry?.id) || summary?.id || '',
    default: entry?.default === true,
    name: readTrimmedString(entry?.name) || readTrimmedString(summary?.name),
    emoji: readTrimmedString(identity?.emoji) || readTrimmedString(summary?.identity?.emoji),
    avatar:
      readTrimmedString(identity?.avatar) ||
      readTrimmedString(identity?.avatarUrl) ||
      readTrimmedString(summary?.identity?.avatar) ||
      readTrimmedString(summary?.identity?.avatarUrl),
    workspace: readTrimmedString(entry?.workspace) || readTrimmedString(summary?.workspace),
    agentDir: readTrimmedString(entry?.agentDir) || readTrimmedString(summary?.agentDir),
    model: normalizeModelPrimary(entry?.model) || readTrimmedString(summary?.model),
    paramsJson: toJsonText(entry?.params),
    subagentsAllowAgents: readStringArray(subagents?.allowAgents)
  }
}

function setOptionalStringField(target: Record<string, unknown>, key: string, value: string): void {
  const normalized = value.trim()
  if (normalized.length > 0) {
    target[key] = normalized
    return
  }
  delete target[key]
}

function removeEmptyRecordField(target: Record<string, unknown>, key: string): void {
  const value = target[key]
  if (!isRecord(value) || Object.keys(value).length > 0) {
    return
  }
  delete target[key]
}

export function composeAgentEntryFromSettingsDraft(params: {
  baseEntry: Record<string, unknown> | null
  draft: OpenClawAgentSettingsDraft
}): {
  entry: Record<string, unknown> | null
  error: string | null
} {
  const nextEntry = params.baseEntry ? deepClone(params.baseEntry) : {}
  const normalizedId = params.draft.id.trim()
  if (!normalizedId) {
    return {
      entry: null,
      error: translateWithAppLanguage('agents.error.idRequired')
    }
  }

  nextEntry.id = normalizedId
  setOptionalStringField(nextEntry, 'name', params.draft.name)
  setOptionalStringField(nextEntry, 'workspace', params.draft.workspace)
  setOptionalStringField(nextEntry, 'agentDir', params.draft.agentDir)
  setOptionalStringField(nextEntry, 'model', params.draft.model)

  const identity = isRecord(nextEntry.identity) ? { ...nextEntry.identity } : {}
  const normalizedEmoji = params.draft.emoji.trim()
  if (normalizedEmoji) {
    identity.emoji = normalizedEmoji
  } else {
    delete identity.emoji
  }
  const normalizedAvatar = params.draft.avatar.trim()
  if (normalizedAvatar) {
    if (/^(https?:\/\/|data:image\/)/i.test(normalizedAvatar)) {
      identity.avatarUrl = normalizedAvatar
      delete identity.avatar
    } else {
      identity.avatar = normalizedAvatar
      delete identity.avatarUrl
    }
  } else {
    delete identity.avatar
    delete identity.avatarUrl
  }
  if (Object.keys(identity).length > 0) {
    nextEntry.identity = identity
  } else {
    delete nextEntry.identity
  }

  if (params.draft.default) {
    nextEntry.default = true
  } else {
    delete nextEntry.default
  }

  const normalizedAllowAgents = Array.from(
    new Set(
      params.draft.subagentsAllowAgents
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    )
  )
  const subagents = isRecord(nextEntry.subagents) ? { ...nextEntry.subagents } : {}
  if (normalizedAllowAgents.length > 0) {
    subagents.allowAgents = normalizedAllowAgents
    nextEntry.subagents = subagents
  } else {
    delete subagents.allowAgents
    if (Object.keys(subagents).length > 0) {
      nextEntry.subagents = subagents
    } else {
      delete nextEntry.subagents
    }
  }

  const paramsJson = params.draft.paramsJson.trim()
  if (!paramsJson) {
    delete nextEntry.params
  } else {
    try {
      nextEntry.params = JSON.parse(paramsJson)
    } catch {
      return {
        entry: null,
        error: translateWithAppLanguage('agents.error.paramsInvalidJson')
      }
    }
  }

  removeEmptyRecordField(nextEntry, 'subagents')

  return {
    entry: nextEntry,
    error: null
  }
}

export function buildConfigWithUpdatedAgentEntry(params: {
  config: Record<string, unknown>
  currentAgentId: string
  nextEntry: Record<string, unknown>
}): {
  config: Record<string, unknown> | null
  error: string | null
  resolvedAgentId: string | null
} {
  const normalizedCurrentAgentId = params.currentAgentId.trim().toLowerCase()
  const normalizedNextAgentId = readTrimmedString(params.nextEntry.id).toLowerCase()
  if (!normalizedNextAgentId) {
    return {
      config: null,
      error: translateWithAppLanguage('agents.error.idRequired'),
      resolvedAgentId: null
    }
  }

  const nextConfig = deepClone(params.config)
  const agentsNode = isRecord(nextConfig.agents) ? { ...nextConfig.agents } : {}
  const list = Array.isArray(agentsNode.list)
    ? agentsNode.list.map((entry) => (isRecord(entry) ? deepClone(entry) : entry))
    : []

  let currentIndex = -1
  for (let index = 0; index < list.length; index += 1) {
    const entry = list[index]
    if (!isRecord(entry)) {
      continue
    }

    if (readTrimmedString(entry.id).toLowerCase() === normalizedCurrentAgentId) {
      currentIndex = index
      break
    }
  }

  const duplicatedIndex = list.findIndex((entry, index) => {
    if (!isRecord(entry) || index === currentIndex) {
      return false
    }
    return readTrimmedString(entry.id).toLowerCase() === normalizedNextAgentId
  })
  if (duplicatedIndex >= 0) {
    return {
      config: null,
      error: translateWithAppLanguage('agents.error.idAlreadyExists', {
        id: readTrimmedString(params.nextEntry.id)
      }),
      resolvedAgentId: null
    }
  }

  if (currentIndex >= 0) {
    list[currentIndex] = deepClone(params.nextEntry)
  } else {
    list.push(deepClone(params.nextEntry))
    currentIndex = list.length - 1
  }

  if (params.nextEntry.default === true) {
    for (let index = 0; index < list.length; index += 1) {
      const entry = list[index]
      if (!isRecord(entry)) {
        continue
      }

      if (index === currentIndex) {
        entry.default = true
      } else {
        delete entry.default
      }
    }
  }

  agentsNode.list = list
  nextConfig.agents = agentsNode

  return {
    config: nextConfig,
    error: null,
    resolvedAgentId: readTrimmedString(params.nextEntry.id) || null
  }
}
