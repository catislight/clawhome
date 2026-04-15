import type {
  OpenClawAgentFileEntry,
  OpenClawAgentIdentity,
  OpenClawAgentRuntime,
  OpenClawAgentSummary,
  OpenClawAgentsFilesGetResult,
  OpenClawAgentsFilesListResult,
  OpenClawAgentsListResult,
  OpenClawModelChoice,
  OpenClawToolCatalogEntry,
  OpenClawToolCatalogGroup,
  OpenClawToolCatalogProfileId,
  OpenClawToolsCatalogResult
} from '@/features/agents/lib/openclaw-agents-types'
import { isMemoryFileName } from '@/features/agents/lib/openclaw-agent-memory-files'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function normalizePathSeparators(value: string): string {
  return value.replace(/\\/g, '/')
}

function normalizeWorkspaceFileName(value: string): string {
  let normalized = normalizePathSeparators(value.trim())

  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2)
  }

  normalized = normalized.replace(/^\/+/, '')
  normalized = normalized.replace(/\/{2,}/g, '/')
  return normalized
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '')
}

function buildFilePath(workspace: string | undefined, name: string, pathValue: string | undefined): string {
  if (pathValue && pathValue.trim()) {
    return normalizePathSeparators(pathValue.trim())
  }

  const normalizedWorkspace = workspace ? trimTrailingSlashes(normalizePathSeparators(workspace)) : ''
  if (!normalizedWorkspace) {
    return name
  }
  return `${normalizedWorkspace}/${name}`
}

function isAbsolutePathLike(value: string): boolean {
  return /^([a-z]:\/|\/)/i.test(value)
}

function resolveFileNameFromPath(pathValue: string, workspace: string | undefined): string {
  const normalizedPath = normalizePathSeparators(pathValue.trim())

  if (!isAbsolutePathLike(normalizedPath)) {
    return normalizeWorkspaceFileName(normalizedPath)
  }

  const normalizedWorkspace = workspace
    ? trimTrailingSlashes(normalizePathSeparators(workspace.trim()))
    : ''

  if (normalizedWorkspace && normalizedPath.startsWith(`${normalizedWorkspace}/`)) {
    return normalizeWorkspaceFileName(normalizedPath.slice(normalizedWorkspace.length + 1))
  }

  const memoryPathMatched = normalizedPath.match(/(?:^|\/)(memory\/.+)$/i)
  if (memoryPathMatched?.[1]) {
    return normalizeWorkspaceFileName(memoryPathMatched[1])
  }

  const segments = normalizedPath.split('/').filter((segment) => segment.length > 0)
  return normalizeWorkspaceFileName(segments[segments.length - 1] ?? '')
}

function resolveFileName(
  nameValue: string | undefined,
  pathValue: string | undefined,
  workspace: string | undefined
): string | null {
  let nameFromValue: string | null = null

  if (nameValue && nameValue.trim()) {
    const normalizedRawName = normalizePathSeparators(nameValue.trim())

    if (isAbsolutePathLike(normalizedRawName)) {
      const fromAbsoluteName = resolveFileNameFromPath(normalizedRawName, workspace)
      nameFromValue = fromAbsoluteName || null
    } else {
      const memoryPathMatched = normalizedRawName.match(/(?:^|\/)(memory\/.+)$/i)
      if (memoryPathMatched?.[1]) {
        nameFromValue = normalizeWorkspaceFileName(memoryPathMatched[1]) || null
      } else {
        const normalizedName = normalizeWorkspaceFileName(nameValue)
        nameFromValue = normalizedName || null
      }
    }
  }

  const nameFromPath =
    pathValue && pathValue.trim() ? resolveFileNameFromPath(pathValue, workspace) || null : null

  if (
    nameFromPath &&
    nameFromPath.toLowerCase().startsWith('memory/') &&
    (!nameFromValue || !nameFromValue.toLowerCase().startsWith('memory/'))
  ) {
    return nameFromPath
  }

  return nameFromValue ?? nameFromPath
}

function readToolCatalogProfileId(value: unknown): OpenClawToolCatalogProfileId | null {
  if (
    value === 'minimal' ||
    value === 'coding' ||
    value === 'messaging' ||
    value === 'full'
  ) {
    return value
  }

  return null
}

function parseAgentIdentity(value: unknown): OpenClawAgentIdentity | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const identity: OpenClawAgentIdentity = {
    name: readString(value.name),
    theme: readString(value.theme),
    emoji: readString(value.emoji),
    avatar: readString(value.avatar),
    avatarUrl: readString(value.avatarUrl)
  }

  if (
    !identity.name &&
    !identity.theme &&
    !identity.emoji &&
    !identity.avatar &&
    !identity.avatarUrl
  ) {
    return undefined
  }

  return identity
}

function parseAgentRuntime(value: unknown): OpenClawAgentRuntime | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  if (value.type === 'embedded') {
    return { type: 'embedded' }
  }

  if (value.type !== 'acp') {
    return undefined
  }

  const mode = value.mode
  return {
    type: 'acp',
    agent: readString(value.agent),
    backend: readString(value.backend),
    mode: mode === 'persistent' || mode === 'oneshot' ? mode : undefined,
    cwd: readString(value.cwd)
  }
}

function parseAgentSummary(value: unknown): OpenClawAgentSummary | null {
  if (!isRecord(value)) {
    return null
  }

  const id = readString(value.id)
  if (!id) {
    return null
  }

  return {
    id,
    name: readString(value.name),
    identity: parseAgentIdentity(value.identity),
    workspace: readString(value.workspace),
    agentDir: readString(value.agentDir),
    model: readString(value.model),
    runtime: parseAgentRuntime(value.runtime)
  }
}

function parseAgentFileEntry(value: unknown, workspace: string | undefined): OpenClawAgentFileEntry | null {
  if (typeof value === 'string' && value.trim()) {
    const name = resolveFileName(value, value, workspace)
    if (!name) {
      return null
    }

    return {
      name,
      path: buildFilePath(workspace, name, undefined),
      missing: false
    }
  }

  if (!isRecord(value)) {
    return null
  }

  const pathValue = readString(value.path)
  const name = resolveFileName(readString(value.name), pathValue, workspace)
  if (!name) {
    return null
  }

  return {
    name,
    path: buildFilePath(workspace, name, pathValue),
    missing: readBoolean(value.missing) ?? false,
    size: readNumber(value.size),
    updatedAtMs: readNumber(value.updatedAtMs),
    content: readString(value.content)
  }
}

function parseAgentFileEntryFromLooseRecord(
  value: Record<string, unknown>,
  workspace: string | undefined
): OpenClawAgentFileEntry | null {
  const pathValue =
    readString(value.path) ??
    readString(value.filePath) ??
    readString(value.relativePath) ??
    readString(value.file)
  const nameValue =
    readString(value.name) ??
    readString(value.fileName) ??
    readString(value.filename) ??
    readString(value.relativeName)
  const name = resolveFileName(nameValue, pathValue, workspace)
  if (!name) {
    return null
  }

  const exists = readBoolean(value.exists)
  const missing = readBoolean(value.missing) ?? (exists === false ? true : false)

  return {
    name,
    path: buildFilePath(workspace, name, pathValue),
    missing,
    size: readNumber(value.size) ?? readNumber(value.bytes),
    updatedAtMs:
      readNumber(value.updatedAtMs) ??
      readNumber(value.mtimeMs) ??
      readNumber(value.updatedAt),
    content: readString(value.content)
  }
}

function collectNestedMemoryEntriesFromPayload(
  payload: unknown,
  workspace: string | undefined
): OpenClawAgentFileEntry[] {
  const results: OpenClawAgentFileEntry[] = []
  const dedupe = new Set<string>()
  const visited = new Set<unknown>()

  function pushIfMemoryEntry(entry: OpenClawAgentFileEntry | null): void {
    if (!entry || !isMemoryFileName(entry.name)) {
      return
    }
    const key = `${entry.name}::${entry.path}`
    if (dedupe.has(key)) {
      return
    }
    dedupe.add(key)
    results.push(entry)
  }

  function visit(node: unknown, depth: number): void {
    if (depth > 12 || node === null || node === undefined) {
      return
    }

    if (typeof node === 'string') {
      pushIfMemoryEntry(parseAgentFileEntry(node, workspace))
      return
    }

    if (typeof node !== 'object') {
      return
    }

    if (visited.has(node)) {
      return
    }
    visited.add(node)

    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item, depth + 1)
      }
      return
    }

    if (!isRecord(node)) {
      return
    }

    pushIfMemoryEntry(parseAgentFileEntryFromLooseRecord(node, workspace))

    for (const value of Object.values(node)) {
      if (typeof value === 'object' && value !== null) {
        visit(value, depth + 1)
      }
    }
  }

  visit(payload, 0)
  return results
}

export function parseOpenClawAgentsList(payload: unknown): OpenClawAgentsListResult | null {
  if (!isRecord(payload) || !Array.isArray(payload.agents)) {
    return null
  }

  const defaultId = readString(payload.defaultId)
  const mainKey = readString(payload.mainKey)
  const scope = readString(payload.scope)
  if (!defaultId || !mainKey || !scope) {
    return null
  }

  return {
    defaultId,
    mainKey,
    scope,
    agents: payload.agents.flatMap((entry) => {
      const parsed = parseAgentSummary(entry)
      return parsed ? [parsed] : []
    })
  }
}

export function parseOpenClawModelsList(payload: unknown): OpenClawModelChoice[] {
  if (!isRecord(payload) || !Array.isArray(payload.models)) {
    return []
  }

  return payload.models.flatMap((entry) => {
    if (!isRecord(entry)) {
      return []
    }

    const id = readString(entry.id)
    const name = readString(entry.name)
    const provider = readString(entry.provider)
    if (!id || !name || !provider) {
      return []
    }

    return [
      {
        id,
        name,
        provider,
        contextWindow: readNumber(entry.contextWindow),
        reasoning: readBoolean(entry.reasoning)
      }
    ]
  })
}

export function parseOpenClawAgentFilesList(payload: unknown): OpenClawAgentsFilesListResult | null {
  if (!isRecord(payload)) {
    return null
  }

  const agentId = readString(payload.agentId)
  const workspace = readString(payload.workspace) ?? readString(payload.workspaceDir)
  const filesRaw = Array.isArray(payload.files)
    ? payload.files
    : Array.isArray(payload.entries)
      ? payload.entries
      : null
  if (!agentId || !workspace) {
    return null
  }

  const parsedFiles = (filesRaw ?? []).flatMap((entry) => {
    const parsed = parseAgentFileEntry(entry, workspace)
    return parsed ? [parsed] : []
  })
  const nestedMemoryFiles = collectNestedMemoryEntriesFromPayload(payload, workspace)

  const mergedByName = new Map<string, OpenClawAgentFileEntry>()
  for (const entry of parsedFiles) {
    mergedByName.set(entry.name, entry)
  }
  for (const entry of nestedMemoryFiles) {
    if (!mergedByName.has(entry.name)) {
      mergedByName.set(entry.name, entry)
    }
  }

  return {
    agentId,
    workspace,
    files: Array.from(mergedByName.values())
  }
}

export function parseOpenClawAgentFile(payload: unknown): OpenClawAgentsFilesGetResult | null {
  if (!isRecord(payload)) {
    return null
  }

  const agentId = readString(payload.agentId)
  const workspace = readString(payload.workspace) ?? readString(payload.workspaceDir)
  const filePayload = isRecord(payload.file) || typeof payload.file === 'string' ? payload.file : payload
  const file = parseAgentFileEntry(filePayload, workspace)
  if (!agentId || !workspace || !file) {
    return null
  }

  return {
    agentId,
    workspace,
    file
  }
}

function parseToolCatalogEntry(value: unknown): OpenClawToolCatalogEntry | null {
  if (!isRecord(value)) {
    return null
  }

  const id = readString(value.id)
  const label = readString(value.label)
  const description = readString(value.description)
  const source = value.source === 'core' || value.source === 'plugin' ? value.source : null
  if (!id || !label || description === undefined || !source || !Array.isArray(value.defaultProfiles)) {
    return null
  }

  const defaultProfiles = value.defaultProfiles.flatMap((entry) => {
    const parsed = readToolCatalogProfileId(entry)
    return parsed ? [parsed] : []
  })

  return {
    id,
    label,
    description,
    source,
    pluginId: readString(value.pluginId),
    optional: readBoolean(value.optional),
    defaultProfiles
  }
}

function parseToolCatalogGroup(value: unknown): OpenClawToolCatalogGroup | null {
  if (!isRecord(value) || !Array.isArray(value.tools)) {
    return null
  }

  const id = readString(value.id)
  const label = readString(value.label)
  const source = value.source === 'core' || value.source === 'plugin' ? value.source : null
  if (!id || !label || !source) {
    return null
  }

  return {
    id,
    label,
    source,
    pluginId: readString(value.pluginId),
    tools: value.tools.flatMap((entry) => {
      const parsed = parseToolCatalogEntry(entry)
      return parsed ? [parsed] : []
    })
  }
}

export function parseOpenClawToolsCatalog(payload: unknown): OpenClawToolsCatalogResult | null {
  if (!isRecord(payload) || !Array.isArray(payload.profiles) || !Array.isArray(payload.groups)) {
    return null
  }

  const agentId = readString(payload.agentId)
  if (!agentId) {
    return null
  }

  const profiles = payload.profiles.flatMap((entry) => {
    if (!isRecord(entry)) {
      return []
    }
    const id = readToolCatalogProfileId(entry.id)
    const label = readString(entry.label)
    if (!id || !label) {
      return []
    }
    return [{ id, label }]
  })

  return {
    agentId,
    profiles,
    groups: payload.groups.flatMap((entry) => {
      const parsed = parseToolCatalogGroup(entry)
      return parsed ? [parsed] : []
    })
  }
}
