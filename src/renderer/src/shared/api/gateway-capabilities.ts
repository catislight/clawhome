import { requestGateway } from '@/shared/api/app-api'
import type { GatewayMethodName } from '@/shared/api/gateway-method-map'

/**
 * 能力缓存有效期：避免每次请求都探测版本，减少额外 RTT。
 */
const GATEWAY_CAPABILITIES_CACHE_TTL_MS = 60_000
const VERSION_PROBE_TIMEOUT_MS = 3_000

/**
 * 版本探测方法候选（按成功概率和通用性从高到低排列）。
 * 上游不同版本可能暴露不同名字，这里逐个尝试。
 */
const VERSION_PROBE_METHODS = [
  'system.version',
  'meta.version',
  'gateway.version',
  'app.version'
] as const

type ParsedGatewayVersion = {
  year: number
  month: number
  patch: number
}

export type GatewayCapabilities = {
  detectedAt: number
  versionRaw: string | null
  version: ParsedGatewayVersion | null
  /**
   * 会话类接口参数优先策略：
   * true  -> 优先传 sessionKey（新协议/当前主路径）
   * false -> 优先传 key（旧协议或特定版本）
   */
  preferSessionKeyParam: boolean
  /**
   * config.set 参数优先策略：
   * true  -> 优先 raw 文本
   * false -> 优先 config 对象
   */
  preferRawConfigSetPayload: boolean
}

type CompatAdapterInput = {
  method: GatewayMethodName
  params: unknown
  capabilities: GatewayCapabilities
}

type PayloadNormalizerInput = {
  method: GatewayMethodName
  payload: unknown
}

const gatewayCapabilitiesCache = new Map<string, GatewayCapabilities>()
const inFlightCapabilitiesRequests = new Map<string, Promise<GatewayCapabilities>>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * 仅解析 2026.3.31 这种语义版本片段。
 * 若上游返回 "v2026.3.31-beta" 这类形式，也能通过正则提取核心数字部分。
 */
function tryParseVersion(value: unknown): ParsedGatewayVersion | null {
  if (typeof value !== 'string') {
    return null
  }

  const match = value.trim().match(/(\d{4})\.(\d{1,2})\.(\d{1,3})/)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const patch = Number(match[3])

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(patch)) {
    return null
  }

  return {
    year,
    month,
    patch
  }
}

function compareVersion(left: ParsedGatewayVersion, right: ParsedGatewayVersion): number {
  if (left.year !== right.year) {
    return left.year - right.year
  }
  if (left.month !== right.month) {
    return left.month - right.month
  }

  return left.patch - right.patch
}

function isAtLeastVersion(
  version: ParsedGatewayVersion | null,
  target: ParsedGatewayVersion
): boolean {
  if (!version) {
    return false
  }

  return compareVersion(version, target) >= 0
}

/**
 * 从不同版本可能出现的 payload 形态中提取版本字符串。
 */
function readVersionFromPayload(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim()
  }

  if (!isRecord(payload)) {
    return null
  }

  const candidates = [payload.version, payload.gatewayVersion, payload.appVersion]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  if (isRecord(payload.meta)) {
    const nestedCandidates = [payload.meta.version, payload.meta.gatewayVersion]
    for (const candidate of nestedCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim()
      }
    }
  }

  return null
}

function buildDefaultCapabilities(): GatewayCapabilities {
  // 默认偏向当前主链路参数形态；如探测失败，仍保证可工作。
  return {
    detectedAt: Date.now(),
    versionRaw: null,
    version: null,
    preferSessionKeyParam: true,
    preferRawConfigSetPayload: true
  }
}

/**
 * 真实探测逻辑：
 * 1. 依次调用版本端点
 * 2. 成功后解析版本
 * 3. 计算兼容开关
 * 4. 全部失败则返回默认能力
 */
async function detectGatewayCapabilities(instanceId: string): Promise<GatewayCapabilities> {
  const fallback = buildDefaultCapabilities()

  for (const method of VERSION_PROBE_METHODS) {
    try {
      const response = await requestGateway({
        instanceId,
        method,
        params: {},
        timeoutMs: VERSION_PROBE_TIMEOUT_MS
      })
      if (!response.success) {
        continue
      }

      const versionRaw = readVersionFromPayload(response.payload)
      if (!versionRaw) {
        continue
      }

      const version = tryParseVersion(versionRaw)
      const preferSessionKeyParam = isAtLeastVersion(version, {
        year: 2026,
        month: 3,
        patch: 23
      })
      const preferRawConfigSetPayload = isAtLeastVersion(version, {
        year: 2026,
        month: 3,
        patch: 28
      })

      return {
        detectedAt: Date.now(),
        versionRaw,
        version,
        preferSessionKeyParam,
        preferRawConfigSetPayload
      }
    } catch {
      // Try the next version-probe method.
    }
  }

  return fallback
}

export async function getGatewayCapabilities(instanceId: string): Promise<GatewayCapabilities> {
  // 优先命中短期缓存。
  const cached = gatewayCapabilitiesCache.get(instanceId)
  if (cached && Date.now() - cached.detectedAt < GATEWAY_CAPABILITIES_CACHE_TTL_MS) {
    return cached
  }

  // 避免并发请求重复探测同一实例。
  const inFlight = inFlightCapabilitiesRequests.get(instanceId)
  if (inFlight) {
    return inFlight
  }

  const next = detectGatewayCapabilities(instanceId)
  inFlightCapabilitiesRequests.set(instanceId, next)

  try {
    const resolved = await next
    gatewayCapabilitiesCache.set(instanceId, resolved)
    return resolved
  } finally {
    inFlightCapabilitiesRequests.delete(instanceId)
  }
}

export function invalidateGatewayCapabilities(instanceId?: string): void {
  // 支持全量清空（调试/全局切换）和按实例清空（连接重建）。
  if (!instanceId) {
    gatewayCapabilitiesCache.clear()
    inFlightCapabilitiesRequests.clear()
    return
  }

  gatewayCapabilitiesCache.delete(instanceId)
  inFlightCapabilitiesRequests.delete(instanceId)
}

/**
 * 候选请求去重：防止别名转换后生成重复请求。
 */
function dedupeRequestCandidates<T>(candidates: T[]): T[] {
  const normalized = new Set<string>()
  const result: T[] = []

  for (const candidate of candidates) {
    const key = JSON.stringify(candidate)
    if (normalized.has(key)) {
      continue
    }
    normalized.add(key)
    result.push(candidate)
  }

  return result
}

/**
 * 会话参数别名候选：
 * - sessionKey -> key
 * - key -> sessionKey
 *
 * 通过生成“双候选”让调用层在不同版本间自动重试。
 */
function buildSessionKeyAliasCandidates(params: unknown): unknown[] {
  if (!isRecord(params)) {
    return [params]
  }

  const candidates: unknown[] = [params]
  const hasSessionKey = typeof params.sessionKey === 'string' && params.sessionKey.trim().length > 0
  const hasKey = typeof params.key === 'string' && params.key.trim().length > 0

  if (hasSessionKey && !hasKey) {
    candidates.push({
      ...params,
      key: params.sessionKey
    })
  } else if (!hasSessionKey && hasKey) {
    candidates.push({
      ...params,
      sessionKey: params.key
    })
  }

  return dedupeRequestCandidates(candidates)
}

/**
 * cron 任务 id 别名候选：
 * - id <-> jobId
 */
function buildCronIdAliasCandidates(params: unknown): unknown[] {
  if (!isRecord(params)) {
    return [params]
  }

  const candidates: unknown[] = [params]
  const hasId = typeof params.id === 'string' && params.id.trim().length > 0
  const hasJobId = typeof params.jobId === 'string' && params.jobId.trim().length > 0

  if (hasId && !hasJobId) {
    candidates.push({
      ...params,
      jobId: params.id
    })
  } else if (!hasId && hasJobId) {
    candidates.push({
      ...params,
      id: params.jobId
    })
  }

  return dedupeRequestCandidates(candidates)
}

/**
 * config.set 兼容候选：
 * - 仅发送 raw 文本形态（gateway 新协议）
 * - 若上层误传 config 对象，则在本地转成 raw 并剥离 config 字段
 *
 * 目的：避免 strict schema 下触发
 * `invalid config.set params: at root: unexpected property 'config'`。
 */
function buildConfigSetCandidates(params: unknown, _preferRawPayload: boolean): unknown[] {
  if (!isRecord(params)) {
    return [params]
  }

  const sanitizedParams = Object.fromEntries(
    Object.entries(params).filter(([key]) => key !== 'config')
  )
  const hasRaw = typeof sanitizedParams.raw === 'string' && sanitizedParams.raw.trim().length > 0

  if (hasRaw) {
    return [sanitizedParams]
  }

  if (isRecord(params.config)) {
    try {
      return [
        {
          ...sanitizedParams,
          raw: JSON.stringify(params.config, null, 2)
        }
      ]
    } catch {
      return [sanitizedParams]
    }
  }

  return [sanitizedParams]
}

export function buildGatewayRequestCandidates({
  method,
  params,
  capabilities
}: CompatAdapterInput): unknown[] {
  /**
   * 统一兼容路由：
   * - 会话类方法走 sessionKey/key 兼容
   * - cron 类方法走 id/jobId 兼容
   * - config.set 固定走 raw 形态（必要时由 config 对象本地转 raw）
   * - 其它方法保持原样
   */
  if (
    method === 'chat.subscribe' ||
    method === 'chat.history' ||
    method === 'chat.send' ||
    method === 'sessions.patch' ||
    method === 'sessions.delete' ||
    method === 'sessions.reset'
  ) {
    const candidates = buildSessionKeyAliasCandidates(params)
    if (capabilities.preferSessionKeyParam) {
      return candidates
    }

    return [...candidates].reverse()
  }

  if (
    method === 'cron.update' ||
    method === 'cron.remove' ||
    method === 'cron.run' ||
    method === 'cron.runs'
  ) {
    return buildCronIdAliasCandidates(params)
  }

  if (method === 'config.set') {
    return buildConfigSetCandidates(params, capabilities.preferRawConfigSetPayload)
  }

  return [params]
}

export function normalizeGatewayPayload({
  method,
  payload
}: PayloadNormalizerInput): unknown {
  /**
   * 返回值归一化是“读取侧兼容”：
   * 把上游历史版本中不同命名结构折叠成当前 parser 预期结构。
   */
  if (method === 'sessions.list') {
    if (Array.isArray(payload)) {
      return {
        sessions: payload
      }
    }

    if (isRecord(payload) && !Array.isArray(payload.sessions) && Array.isArray(payload.items)) {
      return {
        ...payload,
        sessions: payload.items
      }
    }
  }

  if (method === 'cron.list') {
    if (Array.isArray(payload)) {
      return {
        jobs: payload
      }
    }
  }

  if (method === 'skills.status') {
    if (isRecord(payload) && !Array.isArray(payload.skills) && Array.isArray(payload.entries)) {
      return {
        ...payload,
        skills: payload.entries
      }
    }
  }

  return payload
}
