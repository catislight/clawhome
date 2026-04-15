import type { OpenClawConfigSnapshot } from '@/features/agents/lib/openclaw-agents-types'
import type {
  OpenClawInstanceGlobalConfigDraft,
  OpenClawModelEntryDraft,
  OpenClawModelRefDraft
} from '@/features/settings/lib/openclaw-instance-global-config-types'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function toTrimmedString(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
}

function toLineJson(value: unknown): string {
  if (!isRecord(value)) {
    return ''
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

function parseModelRef(value: unknown): OpenClawModelRefDraft | null {
  if (typeof value === 'string') {
    const primary = value.trim()
    if (!primary) {
      return null
    }

    return {
      primary,
      fallbacks: []
    }
  }

  if (!isRecord(value)) {
    return null
  }

  const primary = toTrimmedString(value.primary)
  const fallbacks = toStringArray(value.fallbacks)

  if (!primary && fallbacks.length === 0) {
    return null
  }

  return {
    primary,
    fallbacks
  }
}

function parseModelsCatalog(value: unknown): Record<string, OpenClawModelEntryDraft> {
  if (!isRecord(value)) {
    return {}
  }

  const next: Record<string, OpenClawModelEntryDraft> = {}

  for (const [ref, rawEntry] of Object.entries(value)) {
    const normalizedRef = ref.trim()
    if (!normalizedRef) {
      continue
    }

    if (!isRecord(rawEntry)) {
      next[normalizedRef] = {}
      continue
    }

    const alias = toTrimmedString(rawEntry.alias)
    const params = isRecord(rawEntry.params) ? deepClone(rawEntry.params) : undefined

    next[normalizedRef] = {
      ...(alias ? { alias } : {}),
      ...(params ? { params } : {})
    }
  }

  return next
}

function parseNumericAsString(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value === 'string') {
    const normalized = value.trim()
    if (normalized && /^-?\d+(\.\d+)?$/.test(normalized)) {
      return normalized
    }
  }

  return ''
}

function parseNumberOrUndefined(raw: string): number | undefined {
  const normalized = raw.trim()
  if (!normalized) {
    return undefined
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return undefined
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseAllowFromJson(raw: string): Record<string, string[]> | undefined {
  const normalized = raw.trim()

  if (!normalized) {
    return undefined
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(normalized)
  } catch {
    throw new Error(translateWithAppLanguage('settings.error.draft.elevatedAllowFromInvalidJson'))
  }

  if (!isRecord(parsed)) {
    throw new Error(translateWithAppLanguage('settings.error.draft.elevatedAllowFromMustBeObject'))
  }

  const next: Record<string, string[]> = {}
  for (const [channel, rawValue] of Object.entries(parsed)) {
    const normalizedChannel = channel.trim()
    if (!normalizedChannel) {
      continue
    }

    const values = toStringArray(rawValue)
    if (values.length > 0) {
      next[normalizedChannel] = values
    }
  }

  return Object.keys(next).length > 0 ? next : undefined
}

function buildModelRefForSave(modelRef: OpenClawModelRefDraft | null):
  | string
  | {
      primary?: string
      fallbacks?: string[]
    }
  | undefined {
  if (!modelRef) {
    return undefined
  }

  const primary = modelRef.primary.trim()
  const fallbacks = modelRef.fallbacks
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  if (!primary && fallbacks.length === 0) {
    return undefined
  }

  if (primary && fallbacks.length === 0) {
    return primary
  }

  return {
    ...(primary ? { primary } : {}),
    ...(fallbacks.length > 0 ? { fallbacks } : {})
  }
}

function buildModelsCatalogForSave(
  models: Record<string, OpenClawModelEntryDraft>
): Record<string, unknown> | undefined {
  const next: Record<string, unknown> = {}

  for (const [ref, entry] of Object.entries(models)) {
    const normalizedRef = ref.trim()
    if (!normalizedRef) {
      continue
    }

    const normalizedAlias = typeof entry.alias === 'string' ? entry.alias.trim() : ''
    const params = isRecord(entry.params) ? deepClone(entry.params) : undefined

    next[normalizedRef] = {
      ...(normalizedAlias ? { alias: normalizedAlias } : {}),
      ...(params ? { params } : {})
    }
  }

  return Object.keys(next).length > 0 ? next : undefined
}

export function valuesToMultiline(values: string[]): string {
  return values.join('\n')
}

export function multilineToValues(raw: string): string[] {
  return raw
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

export function buildDraftFromConfigSnapshot(
  snapshot: OpenClawConfigSnapshot
): OpenClawInstanceGlobalConfigDraft {
  const config = snapshot.config
  const agents = isRecord(config.agents) ? config.agents : undefined
  const defaults = isRecord(agents?.defaults) ? agents.defaults : undefined
  const tools = isRecord(config.tools) ? config.tools : undefined

  const baseModel = parseModelRef(defaults?.model)
  const agentToAgent = isRecord(tools?.agentToAgent) ? tools.agentToAgent : undefined
  const elevated = isRecord(tools?.elevated) ? tools.elevated : undefined
  const exec = isRecord(tools?.exec) ? tools.exec : undefined

  return {
    agentsDefaults: {
      workspace: toTrimmedString(defaults?.workspace),
      repoRoot: toTrimmedString(defaults?.repoRoot),
      modelPrimary: baseModel?.primary ?? '',
      modelFallbacks: baseModel?.fallbacks ?? [],
      models: parseModelsCatalog(defaults?.models),
      imageModel: parseModelRef(defaults?.imageModel),
      pdfModel: parseModelRef(defaults?.pdfModel),
      contextTokens: parseNumericAsString(defaults?.contextTokens),
      maxConcurrent: parseNumericAsString(defaults?.maxConcurrent)
    },
    tools: {
      profile: toTrimmedString(tools?.profile),
      allow: toStringArray(tools?.allow),
      deny: toStringArray(tools?.deny),
      agentToAgentEnabled: Boolean(agentToAgent?.enabled),
      agentToAgentAllow: toStringArray(agentToAgent?.allow),
      elevatedEnabled:
        typeof elevated?.enabled === 'boolean' ? elevated.enabled : true,
      elevatedAllowFromJson: toLineJson(elevated?.allowFrom),
      execHost:
        exec?.host === 'sandbox' || exec?.host === 'gateway' || exec?.host === 'node'
          ? exec.host
          : '',
      execSecurity:
        exec?.security === 'deny' || exec?.security === 'allowlist' || exec?.security === 'full'
          ? exec.security
          : '',
      execAsk:
        exec?.ask === 'off' || exec?.ask === 'on-miss' || exec?.ask === 'always'
          ? exec.ask
          : '',
      execNode: toTrimmedString(exec?.node)
    }
  }
}

export function buildConfigFromDraft(params: {
  baseConfig: Record<string, unknown>
  draft: OpenClawInstanceGlobalConfigDraft
}): Record<string, unknown> {
  const nextConfig = deepClone(params.baseConfig)

  const nextAgents = isRecord(nextConfig.agents) ? { ...nextConfig.agents } : {}
  const nextDefaults = isRecord(nextAgents.defaults) ? { ...nextAgents.defaults } : {}

  const workspace = params.draft.agentsDefaults.workspace.trim()
  if (workspace) {
    nextDefaults.workspace = workspace
  } else {
    delete nextDefaults.workspace
  }

  const repoRoot = params.draft.agentsDefaults.repoRoot.trim()
  if (repoRoot) {
    nextDefaults.repoRoot = repoRoot
  } else {
    delete nextDefaults.repoRoot
  }

  const baseModel = buildModelRefForSave({
    primary: params.draft.agentsDefaults.modelPrimary,
    fallbacks: params.draft.agentsDefaults.modelFallbacks
  })
  if (baseModel) {
    nextDefaults.model = baseModel
  } else {
    delete nextDefaults.model
  }

  const modelsCatalog = buildModelsCatalogForSave(params.draft.agentsDefaults.models)
  if (modelsCatalog) {
    nextDefaults.models = modelsCatalog
  } else {
    delete nextDefaults.models
  }

  const imageModel = buildModelRefForSave(params.draft.agentsDefaults.imageModel)
  if (imageModel) {
    nextDefaults.imageModel = imageModel
  } else {
    delete nextDefaults.imageModel
  }

  const pdfModel = buildModelRefForSave(params.draft.agentsDefaults.pdfModel)
  if (pdfModel) {
    nextDefaults.pdfModel = pdfModel
  } else {
    delete nextDefaults.pdfModel
  }

  const contextTokens = parseNumberOrUndefined(params.draft.agentsDefaults.contextTokens)
  if (contextTokens !== undefined) {
    nextDefaults.contextTokens = contextTokens
  } else {
    delete nextDefaults.contextTokens
  }

  const maxConcurrent = parseNumberOrUndefined(params.draft.agentsDefaults.maxConcurrent)
  if (maxConcurrent !== undefined) {
    nextDefaults.maxConcurrent = maxConcurrent
  } else {
    delete nextDefaults.maxConcurrent
  }

  if (Object.keys(nextDefaults).length > 0) {
    nextAgents.defaults = nextDefaults
  } else {
    delete nextAgents.defaults
  }

  if (Object.keys(nextAgents).length > 0) {
    nextConfig.agents = nextAgents
  } else {
    delete nextConfig.agents
  }

  const nextTools = isRecord(nextConfig.tools) ? { ...nextConfig.tools } : {}

  const toolProfile = params.draft.tools.profile.trim()
  if (toolProfile) {
    nextTools.profile = toolProfile
  } else {
    delete nextTools.profile
  }

  if (params.draft.tools.allow.length > 0) {
    nextTools.allow = params.draft.tools.allow
  } else {
    delete nextTools.allow
  }

  if (params.draft.tools.deny.length > 0) {
    nextTools.deny = params.draft.tools.deny
  } else {
    delete nextTools.deny
  }

  const nextAgentToAgent = isRecord(nextTools.agentToAgent) ? { ...nextTools.agentToAgent } : {}
  nextAgentToAgent.enabled = params.draft.tools.agentToAgentEnabled
  if (params.draft.tools.agentToAgentAllow.length > 0) {
    nextAgentToAgent.allow = params.draft.tools.agentToAgentAllow
  } else {
    delete nextAgentToAgent.allow
  }
  nextTools.agentToAgent = nextAgentToAgent

  const nextElevated = isRecord(nextTools.elevated) ? { ...nextTools.elevated } : {}
  nextElevated.enabled = params.draft.tools.elevatedEnabled
  const allowFrom = parseAllowFromJson(params.draft.tools.elevatedAllowFromJson)
  if (allowFrom) {
    nextElevated.allowFrom = allowFrom
  } else {
    delete nextElevated.allowFrom
  }
  nextTools.elevated = nextElevated

  const nextExec = isRecord(nextTools.exec) ? { ...nextTools.exec } : {}
  const execHost = params.draft.tools.execHost.trim()
  if (execHost) {
    nextExec.host = execHost
  } else {
    delete nextExec.host
  }

  const execSecurity = params.draft.tools.execSecurity.trim()
  if (execSecurity) {
    nextExec.security = execSecurity
  } else {
    delete nextExec.security
  }

  const execAsk = params.draft.tools.execAsk.trim()
  if (execAsk) {
    nextExec.ask = execAsk
  } else {
    delete nextExec.ask
  }

  const execNode = params.draft.tools.execNode.trim()
  if (execNode) {
    nextExec.node = execNode
  } else {
    delete nextExec.node
  }

  if (Object.keys(nextExec).length > 0) {
    nextTools.exec = nextExec
  } else {
    delete nextTools.exec
  }

  if (Object.keys(nextTools).length > 0) {
    nextConfig.tools = nextTools
  } else {
    delete nextConfig.tools
  }

  return nextConfig
}

export function upsertModelsCatalogEntry(params: {
  models: Record<string, OpenClawModelEntryDraft>
  ref: string
  alias: string
  paramsText: string
}): Record<string, OpenClawModelEntryDraft> {
  const normalizedRef = params.ref.trim()
  if (!normalizedRef) {
    throw new Error(translateWithAppLanguage('settings.error.draft.modelRefRequired'))
  }

  let parsedParams: Record<string, unknown> | undefined
  if (params.paramsText.trim()) {
    try {
      const parsed = JSON.parse(params.paramsText)
      if (!isRecord(parsed)) {
        throw new Error(translateWithAppLanguage('settings.error.draft.modelParamsMustBeObject'))
      }
      parsedParams = parsed
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(translateWithAppLanguage('settings.error.draft.modelParamsInvalidJson'))
    }
  }

  const next = { ...params.models }
  next[normalizedRef] = {
    ...(params.alias.trim() ? { alias: params.alias.trim() } : {}),
    ...(parsedParams ? { params: parsedParams } : {})
  }

  return next
}

export function deleteModelsCatalogEntry(params: {
  models: Record<string, OpenClawModelEntryDraft>
  ref: string
}): Record<string, OpenClawModelEntryDraft> {
  const next = { ...params.models }
  delete next[params.ref]
  return next
}

export function formatModelEntryParams(params: Record<string, unknown> | undefined): string {
  if (!params) {
    return ''
  }

  try {
    return JSON.stringify(params, null, 2)
  } catch {
    return ''
  }
}
