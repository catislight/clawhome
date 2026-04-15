import { requestGateway } from '@/shared/api/app-api'
import { getGatewayCapabilities } from '@/shared/api/gateway-capabilities'

export type OpenClawInstanceRuntimeSnapshot = {
  openclawVersion: string | null
  platform: string | null
  uptimeSeconds: number | null
  lastActiveAt: string | null
  deviceId: string | null
  fetchedAtMs: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readValueByPath(source: unknown, path: string): unknown {
  const segments = path.split('.')
  let current: unknown = source

  for (const segment of segments) {
    if (!isRecord(current)) {
      return undefined
    }
    current = current[segment]
  }

  return current
}

function readFirstString(source: unknown, paths: string[]): string | null {
  for (const path of paths) {
    const value = readValueByPath(source, path)
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function readFirstNumber(source: unknown, paths: string[]): number | null {
  for (const path of paths) {
    const value = readValueByPath(source, path)
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }

  return null
}

function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const asMs = value > 1_000_000_000_000 ? value : value * 1_000
    const parsed = new Date(asMs)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  return null
}

const RUNTIME_METHOD_CANDIDATES = [
  'system.info',
  'system.status',
  'gateway.status',
  'meta.status',
  'status'
] as const

const VERSION_METHOD_CANDIDATES = [
  'system.version',
  'meta.version',
  'gateway.version',
  'app.version'
] as const

const PLATFORM_METHOD_CANDIDATES = [
  'system.info',
  'system.status',
  'gateway.status',
  'meta.status',
  'status',
  'meta.info'
] as const

async function requestFirstGatewayPayload(
  instanceId: string,
  methods: readonly string[]
): Promise<unknown> {
  const paramCandidates: Array<{} | undefined> = [undefined, {}]

  for (const method of methods) {
    for (const params of paramCandidates) {
      const result = await requestGateway({
        instanceId,
        method,
        ...(params ? { params } : {}),
        timeoutMs: 3_000
      }).catch(() => null)

      if (result?.success) {
        return result.payload
      }
    }
  }

  return null
}

export async function readOpenClawInstanceRuntimeSnapshot(
  instanceId: string
): Promise<OpenClawInstanceRuntimeSnapshot | null> {
  const capabilities = await getGatewayCapabilities(instanceId).catch(() => null)
  const payload = await requestFirstGatewayPayload(instanceId, RUNTIME_METHOD_CANDIDATES)
  const versionPayload = await requestFirstGatewayPayload(instanceId, VERSION_METHOD_CANDIDATES)
  const platformPayload = await requestFirstGatewayPayload(instanceId, PLATFORM_METHOD_CANDIDATES)

  const uptimeSecondsRaw = readFirstNumber(payload, [
    'uptime',
    'uptimeSec',
    'uptimeSeconds',
    'runtime.uptime',
    'runtime.uptimeSec',
    'runtime.uptimeSeconds'
  ])

  const uptimeMsRaw = readFirstNumber(payload, ['uptimeMs', 'runtime.uptimeMs'])
  const uptimeSeconds =
    typeof uptimeSecondsRaw === 'number'
      ? uptimeSecondsRaw
      : typeof uptimeMsRaw === 'number'
        ? uptimeMsRaw / 1_000
        : null

  const lastActiveAt =
    toIsoTimestamp(
      readValueByPath(payload, 'lastActiveAt') ??
        readValueByPath(payload, 'lastSeenAt') ??
        readValueByPath(payload, 'updatedAt') ??
        readValueByPath(payload, 'heartbeatAt') ??
        readValueByPath(payload, 'runtime.lastActiveAt')
    ) ?? null

  return {
    openclawVersion:
      capabilities?.versionRaw ??
      readFirstString(versionPayload, [
        'server.version',
        'version',
        'gatewayVersion',
        'appVersion',
        'meta.version',
        'build.version',
        'runtime.version'
      ]) ??
      readFirstString(payload, [
        'server.version',
        'version',
        'gatewayVersion',
        'appVersion',
        'meta.version',
        'build.version',
        'runtime.version'
      ]) ??
      null,
    platform:
      readFirstString(platformPayload, [
        'platform',
        'os',
        'runtime.platform',
        'runtime.os',
        'system.platform',
        'system.os',
        'host.platform',
        'host.os',
        'process.platform',
        'process.os'
      ]) ?? null,
    uptimeSeconds: typeof uptimeSeconds === 'number' && Number.isFinite(uptimeSeconds) ? uptimeSeconds : null,
    lastActiveAt,
    deviceId: readFirstString(payload, ['deviceId', 'device.id', 'auth.deviceId', 'runtime.deviceId']),
    fetchedAtMs: Date.now()
  }
}
