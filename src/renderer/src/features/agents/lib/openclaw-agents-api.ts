import { requestGatewayMethod } from '@/shared/api/gateway-client'
import type {
  GatewayMethodName,
  GatewayMethodParams,
  GatewayMethodPayload
} from '@/shared/api/gateway-method-map'
import {
  parseOpenClawAgentFile,
  parseOpenClawAgentFilesList,
  parseOpenClawAgentsList,
  parseOpenClawModelsList,
  parseOpenClawToolsCatalog
} from '@/features/agents/lib/openclaw-agents-parsers'
import type {
  OpenClawAgentCreatePayload,
  OpenClawConfigSnapshot,
  OpenClawAgentsFilesGetResult,
  OpenClawAgentsFilesListResult,
  OpenClawAgentsListResult,
  OpenClawModelChoice,
  OpenClawToolsCatalogResult
} from '@/features/agents/lib/openclaw-agents-types'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

/**
 * agents.create 的成功返回结构。
 * 解析函数会做强校验，避免业务层直接信任 unknown payload。
 */
type OpenClawAgentsCreateResult = {
  ok: true
  agentId: string
  name: string
  workspace: string
}

type OpenClawConfigSetResult = {
  ok: true
  path: string
  config: Record<string, unknown>
}

/**
 * 限定本模块可调用的 gateway 方法域，避免跨域误调用。
 */
type OpenClawAgentsGatewayMethod = Extract<
  GatewayMethodName,
  `agents.${string}` | 'models.list' | 'config.get' | 'config.set' | 'tools.catalog'
>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * agents 模块统一请求入口：
 * - 固定超时
 * - 自动获得 compatibility adapter 与 payload 归一能力
 */
async function requestAgentsPayload<M extends OpenClawAgentsGatewayMethod>(
  instanceId: string,
  method: M,
  params: GatewayMethodParams<M>
): Promise<GatewayMethodPayload<M>> {
  return await requestGatewayMethod(instanceId, method, params, {
    timeoutMs: 20_000
  })
}

function parseCreateAgentResult(payload: unknown): OpenClawAgentsCreateResult | null {
  if (typeof payload !== 'object' || payload === null) {
    return null
  }

  const record = payload as Record<string, unknown>
  if (
    record.ok !== true ||
    typeof record.agentId !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.workspace !== 'string'
  ) {
    return null
  }

  return {
    ok: true,
    agentId: record.agentId,
    name: record.name,
    workspace: record.workspace
  }
}

function parseConfigSnapshot(payload: unknown): OpenClawConfigSnapshot | null {
  if (!isRecord(payload) || !isRecord(payload.config)) {
    return null
  }

  return {
    hash: typeof payload.hash === 'string' ? payload.hash : undefined,
    config: payload.config
  }
}

/**
 * config.set 返回体解析：
 * 只关心 UI 需要的 path + config，其他字段由后续需求再扩展。
 */
function parseConfigSetResult(payload: unknown): OpenClawConfigSetResult | null {
  if (
    !isRecord(payload) ||
    payload.ok !== true ||
    typeof payload.path !== 'string' ||
    !isRecord(payload.config)
  ) {
    return null
  }

  return {
    ok: true,
    path: payload.path,
    config: payload.config
  }
}

export async function listOpenClawAgents(instanceId: string): Promise<OpenClawAgentsListResult> {
  const payload = await requestAgentsPayload(instanceId, 'agents.list', {})
  const result = parseOpenClawAgentsList(payload)

  if (!result) {
    throw new Error(translateWithAppLanguage('agents.error.api.listInvalidPayload'))
  }

  return result
}

export async function createOpenClawAgent(
  instanceId: string,
  params: OpenClawAgentCreatePayload
): Promise<OpenClawAgentsCreateResult> {
  const payload = await requestAgentsPayload(instanceId, 'agents.create', params)
  const result = parseCreateAgentResult(payload)
  if (!result) {
    throw new Error(translateWithAppLanguage('agents.error.api.createInvalidPayload'))
  }

  return result
}

export async function listOpenClawAgentFiles(
  instanceId: string,
  agentId: string
): Promise<OpenClawAgentsFilesListResult> {
  const payload = await requestAgentsPayload(instanceId, 'agents.files.list', { agentId })
  const result = parseOpenClawAgentFilesList(payload)

  if (!result) {
    throw new Error(translateWithAppLanguage('agents.error.api.filesListInvalidPayload'))
  }

  return result
}

export async function getOpenClawAgentFile(
  instanceId: string,
  agentId: string,
  name: string
): Promise<OpenClawAgentsFilesGetResult> {
  const payload = await requestAgentsPayload(instanceId, 'agents.files.get', {
    agentId,
    name
  })
  const result = parseOpenClawAgentFile(payload)

  if (!result) {
    throw new Error(translateWithAppLanguage('agents.error.api.filesGetInvalidPayload'))
  }

  return result
}

export async function setOpenClawAgentFile(
  instanceId: string,
  agentId: string,
  name: string,
  content: string
): Promise<OpenClawAgentsFilesGetResult> {
  const payload = await requestAgentsPayload(instanceId, 'agents.files.set', {
    agentId,
    name,
    content
  })
  const result = parseOpenClawAgentFile(payload)

  if (!result) {
    throw new Error(translateWithAppLanguage('agents.error.api.filesSetInvalidPayload'))
  }

  return result
}

export async function listOpenClawModelChoices(instanceId: string): Promise<OpenClawModelChoice[]> {
  // 模型列表允许空数组，解析器会兜底，不在这里抛错。
  const payload = await requestAgentsPayload(instanceId, 'models.list', {})
  return parseOpenClawModelsList(payload)
}

export async function listOpenClawToolsCatalog(
  instanceId: string,
  options?: { agentId?: string; includePlugins?: boolean }
): Promise<OpenClawToolsCatalogResult> {
  const payload = await requestAgentsPayload(instanceId, 'tools.catalog', {
    ...(options?.agentId ? { agentId: options.agentId } : {}),
    ...(typeof options?.includePlugins === 'boolean'
      ? { includePlugins: options.includePlugins }
      : {})
  })

  const result = parseOpenClawToolsCatalog(payload)
  if (!result) {
    throw new Error(translateWithAppLanguage('agents.error.api.toolsCatalogInvalidPayload'))
  }

  return result
}

export async function getOpenClawConfigSnapshot(
  instanceId: string
): Promise<OpenClawConfigSnapshot> {
  const payload = await requestAgentsPayload(instanceId, 'config.get', {})
  const result = parseConfigSnapshot(payload)

  if (!result) {
    throw new Error(translateWithAppLanguage('agents.error.api.configGetInvalidPayload'))
  }

  return result
}

export async function setOpenClawConfigSnapshot(
  instanceId: string,
  params: {
    config: Record<string, unknown>
    baseHash?: string
  }
): Promise<OpenClawConfigSnapshot> {
  // 当前主写入协议仍优先 raw 文本；compat adapter 会在需要时补 config 形态候选。
  const payload = await requestAgentsPayload(instanceId, 'config.set', {
    raw: JSON.stringify(params.config, null, 2),
    ...(typeof params.baseHash === 'string' && params.baseHash.trim()
      ? { baseHash: params.baseHash.trim() }
      : {})
  })

  const result = parseConfigSetResult(payload)
  if (!result) {
    throw new Error(translateWithAppLanguage('agents.error.api.configSetInvalidPayload'))
  }

  return {
    hash: params.baseHash,
    config: result.config
  }
}
